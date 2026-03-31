#!/usr/bin/env node
/**
 * Creates an optimized deploy database without the large `tags` column.
 * The full sluizen.db (~91MB) contains raw OSM JSON tags per record.
 * This script strips that to produce sluizen_deploy.db (~17MB) for Vercel.
 *
 * Usage: node scripts/create-deploy-db.js
 *    or: npm run build-db
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const srcPath = path.join(__dirname, "../database/sluizen.db");
const dstPath = path.join(__dirname, "../database/sluizen_deploy.db");

if (!fs.existsSync(srcPath)) {
  console.error("Source database not found:", srcPath);
  console.error("Run `npm run import` first to create the full database.");
  process.exit(1);
}

// Remove existing deploy db
if (fs.existsSync(dstPath)) fs.unlinkSync(dstPath);

const src = new Database(srcPath, { readonly: true });
const dst = new Database(dstPath);
dst.pragma("journal_mode = WAL");

dst.exec(`
  CREATE TABLE sluizen (
    id TEXT PRIMARY KEY,
    naam TEXT,
    lat REAL,
    lon REAL,
    type TEXT,
    bediening TEXT,
    provincie TEXT,
    gemeente TEXT,
    lengte REAL,
    breedte REAL,
    diepte REAL,
    maxhoogte REAL,
    eigenaar TEXT,
    bouwjaar INTEGER,
    vhf TEXT,
    openingstijden TEXT,
    website TEXT,
    wikipedia TEXT,
    bron TEXT,
    categorie TEXT
  );
  CREATE INDEX idx_provincie ON sluizen(provincie);
  CREATE INDEX idx_type ON sluizen(type);
  CREATE INDEX idx_bediening ON sluizen(bediening);
  CREATE INDEX idx_bron ON sluizen(bron);
  CREATE INDEX idx_categorie ON sluizen(categorie);
  CREATE INDEX idx_naam ON sluizen(naam);

  CREATE TABLE statistieken (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Copy sluizen rows (without tags)
const rows = src
  .prepare(
    "SELECT id,naam,lat,lon,type,bediening,provincie,gemeente,lengte,breedte,diepte,maxhoogte,eigenaar,bouwjaar,vhf,openingstijden,website,wikipedia,bron,categorie FROM sluizen"
  )
  .all();

const insert = dst.prepare(
  `INSERT OR IGNORE INTO sluizen VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);
const insertMany = dst.transaction((records) => {
  for (const r of records) {
    insert.run(
      r.id, r.naam, r.lat, r.lon, r.type, r.bediening, r.provincie,
      r.gemeente, r.lengte, r.breedte, r.diepte, r.maxhoogte, r.eigenaar,
      r.bouwjaar, r.vhf, r.openingstijden, r.website, r.wikipedia,
      r.bron, r.categorie
    );
  }
});
insertMany(rows);

// Copy statistieken
const stats = src.prepare("SELECT key, value FROM statistieken").all();
const insertStat = dst.prepare(
  "INSERT INTO statistieken (key, value) VALUES (?, ?)"
);
const insertStats = dst.transaction((recs) => {
  for (const r of recs) insertStat.run(r.key, r.value);
});
insertStats(stats);

dst.exec("VACUUM");
dst.close();
src.close();

const srcSize = fs.statSync(srcPath).size;
const dstSize = fs.statSync(dstPath).size;
console.log(`Done!`);
console.log(`  Records: ${rows.length}`);
console.log(`  Full DB:   ${(srcSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Deploy DB: ${(dstSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Reduction: ${((1 - dstSize / srcSize) * 100).toFixed(0)}%`);
