/**
 * Koppelt elk record aan het waterschap via point-in-polygon.
 * Bron: Geoportaal Overijssel (officiële waterschapsgrenzen NL)
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const turf = require('@turf/turf');

const db = new Database(path.join(__dirname, '../database/sluizen.db'));
const waterschappenGeo = JSON.parse(fs.readFileSync('/tmp/waterschappen_wgs84.json'));

console.log(`Waterschappen: ${waterschappenGeo.features.length}`);

// Voeg beheerder kolom toe als die er nog niet is
try { db.exec('ALTER TABLE sluizen ADD COLUMN beheerder TEXT'); } catch(e) {}

// Alleen records zonder beheerder updaten
const records = db.prepare(`
  SELECT id, lat, lon FROM sluizen
  WHERE (beheerder IS NULL OR beheerder = '')
    AND lat IS NOT NULL AND lon IS NOT NULL
    AND lat BETWEEN 50.7 AND 53.6
    AND lon BETWEEN 3.3 AND 7.3
`).all();

console.log(`Records te verwerken: ${records.length}`);

const updateStmt = db.prepare('UPDATE sluizen SET beheerder = ? WHERE id = ?');

const updateBatch = db.transaction((batch) => {
  for (const { id, beheerder } of batch) updateStmt.run(beheerder, id);
});

let updated = 0, notFound = 0;
let batchBuffer = [];

for (let i = 0; i < records.length; i++) {
  const { id, lat, lon } = records[i];
  const pt = turf.point([lon, lat]);
  let beheerder = null;

  for (const feature of waterschappenGeo.features) {
    try {
      if (turf.booleanPointInPolygon(pt, feature)) {
        beheerder = feature.properties.WATERSCHAP;
        break;
      }
    } catch(e) {}
  }

  if (beheerder) {
    batchBuffer.push({ id, beheerder });
    updated++;
  } else {
    notFound++;
  }

  if (batchBuffer.length >= 1000) {
    updateBatch(batchBuffer);
    batchBuffer = [];
  }

  if ((i + 1) % 10000 === 0) {
    console.log(`  ${i+1}/${records.length} | Gevonden: ${updated} | Niet gevonden: ${notFound}`);
  }
}

if (batchBuffer.length > 0) updateBatch(batchBuffer);

console.log(`\nKlaar! Bijgewerkt: ${updated} | Niet gevonden: ${notFound}`);
const totaal = db.prepare("SELECT COUNT(*) as c FROM sluizen WHERE beheerder IS NOT NULL AND beheerder != ''").get();
console.log(`Totaal met beheerder: ${totaal.c}`);
db.close();
