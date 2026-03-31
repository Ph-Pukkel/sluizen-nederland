/**
 * Lokale point-in-polygon geocoding voor gemeente en provincie.
 * Gebruikt CBS gebiedsindelingen (PDOK) — geen externe API calls tijdens uitvoering.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const turf = require('@turf/turf');

const dbPath = path.join(__dirname, '../database/sluizen.db');
const db = new Database(dbPath);

// Laad gemeente en provincie GeoJSON
const gemeentenGeo = JSON.parse(fs.readFileSync('/tmp/gemeenten_wgs84.json'));
const provinciesGeo = JSON.parse(fs.readFileSync('/tmp/provincies_wgs84.json'));

console.log(`Gemeenten: ${gemeentenGeo.features.length}, Provincies: ${provinciesGeo.features.length}`);

// Bouw lookup index
const gemeenten = gemeentenGeo.features;
const provincies = provinciesGeo.features;

// Haal alle records op zonder gemeente (of met 'Onbekend')
const records = db.prepare(`
  SELECT id, lat, lon FROM sluizen
  WHERE (gemeente IS NULL OR gemeente = '' OR gemeente = 'Onbekend')
    AND lat IS NOT NULL AND lon IS NOT NULL
    AND lat BETWEEN 50.7 AND 53.6
    AND lon BETWEEN 3.3 AND 7.3
`).all();

console.log(`Records te verwerken: ${records.length}`);

const updateStmt = db.prepare(`
  UPDATE sluizen SET gemeente = ?, provincie = ? WHERE id = ?
`);

let updated = 0;
let notFound = 0;
const batchSize = 1000;

const updateBatch = db.transaction((batch) => {
  for (const { id, gemeente, provincie } of batch) {
    updateStmt.run(gemeente, provincie, id);
  }
});

let batchBuffer = [];

for (let i = 0; i < records.length; i++) {
  const { id, lat, lon } = records[i];
  const pt = turf.point([lon, lat]);

  let gemeente = null;
  let provincie = null;

  // Zoek gemeente
  for (const feature of gemeenten) {
    if (turf.booleanPointInPolygon(pt, feature)) {
      gemeente = feature.properties.statnaam;
      break;
    }
  }

  // Zoek provincie
  for (const feature of provincies) {
    if (turf.booleanPointInPolygon(pt, feature)) {
      provincie = feature.properties.statnaam;
      break;
    }
  }

  if (gemeente || provincie) {
    batchBuffer.push({ id, gemeente: gemeente || 'Onbekend', provincie: provincie || 'Onbekend' });
    updated++;
  } else {
    notFound++;
  }

  // Commit per 1000
  if (batchBuffer.length >= batchSize) {
    updateBatch(batchBuffer);
    batchBuffer = [];
  }

  if ((i + 1) % 5000 === 0) {
    console.log(`  Verwerkt: ${i + 1}/${records.length} | Gevonden: ${updated} | Niet gevonden: ${notFound}`);
  }
}

// Resterende batch
if (batchBuffer.length > 0) {
  updateBatch(batchBuffer);
}

console.log(`\nKlaar!`);
console.log(`  Bijgewerkt: ${updated}`);
console.log(`  Niet gevonden (buiten NL?): ${notFound}`);

// Eindresultaat
const totaalMet = db.prepare(`SELECT COUNT(*) as c FROM sluizen WHERE gemeente IS NOT NULL AND gemeente != '' AND gemeente != 'Onbekend'`).get();
const totaalZonder = db.prepare(`SELECT COUNT(*) as c FROM sluizen WHERE gemeente IS NULL OR gemeente = '' OR gemeente = 'Onbekend'`).get();
console.log(`\nDatabase totaal:`);
console.log(`  Met gemeente: ${totaalMet.c}`);
console.log(`  Zonder gemeente: ${totaalZonder.c}`);

db.close();
