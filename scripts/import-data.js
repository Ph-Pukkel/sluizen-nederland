#!/usr/bin/env node
/**
 * Import script: fetches all sluizen from OpenStreetMap via Overpass API
 * and stores them in a local SQLite database + JSON fallback.
 *
 * Usage: node scripts/import-data.js
 *    or: npm run import
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const https = require("https");

const DB_PATH = path.join(__dirname, "..", "database", "sluizen.db");
const JSON_PATH = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "sluizen.json"
);
const STATS_PATH = path.join(
  __dirname,
  "..",
  "public",
  "data",
  "statistieken.json"
);

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_FALLBACK = "https://overpass.kumi.systems/api/interpreter";

// ---------------------------------------------------------------------------
// Overpass queries
// ---------------------------------------------------------------------------

const QUERY_MAIN = `[out:json][timeout:180];
area["ISO3166-1"="NL"][admin_level=2]->.nl;
(
  node["waterway"="lock"](area.nl);
  way["waterway"="lock"](area.nl);
  node["lock"="yes"](area.nl);
  way["lock"="yes"](area.nl);
  node["waterway"="lock_gate"](area.nl);
  way["waterway"="lock_gate"](area.nl);
  node["waterway"="sluice_gate"](area.nl);
  node["water_control"="sluice"](area.nl);
  way["water_control"="sluice"](area.nl);
  node["man_made"="lock"](area.nl);
  way["man_made"="sluice"](area.nl);
);
out body center;
>;
out skel qt;`;

const QUERY_EXTRA = `[out:json][timeout:180];
area["ISO3166-1"="NL"][admin_level=2]->.nl;
(
  node["waterway"="weir"]["lock"="yes"](area.nl);
  way["waterway"="weir"]["lock"="yes"](area.nl);
  relation["waterway"="lock"](area.nl);
  relation["lock"="yes"](area.nl);
);
out body center;
>;
out skel qt;`;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function postOverpass(url, query) {
  return new Promise((resolve, reject) => {
    const body = `data=${encodeURIComponent(query)}`;
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          if (
            res.statusCode !== 200 ||
            !text.startsWith("{")
          ) {
            reject(
              new Error(
                `Overpass returned status ${res.statusCode}: ${text.slice(0, 300)}`
              )
            );
          } else {
            resolve(JSON.parse(text));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function fetchOverpass(query) {
  try {
    console.log(`  Trying primary endpoint...`);
    return await postOverpass(OVERPASS_URL, query);
  } catch (err) {
    console.log(`  Primary failed (${err.message}), trying fallback...`);
    return await postOverpass(OVERPASS_FALLBACK, query);
  }
}

// ---------------------------------------------------------------------------
// Data processing helpers
// ---------------------------------------------------------------------------

function getCenterForWay(way, nodeLookup) {
  if (way.center) return { lat: way.center.lat, lon: way.center.lon };
  if (!way.nodes) return null;
  const coords = way.nodes
    .filter((id) => nodeLookup.has(id))
    .map((id) => nodeLookup.get(id));
  if (coords.length === 0) return null;
  return {
    lat: coords.reduce((s, n) => s + n.lat, 0) / coords.length,
    lon: coords.reduce((s, n) => s + n.lon, 0) / coords.length,
  };
}

function determineType(tags) {
  if (
    tags.waterway === "lock" ||
    tags.lock === "yes" ||
    tags.man_made === "lock"
  )
    return "schutsluis";
  if (tags.waterway === "lock_gate") return "sluisdeur";
  if (
    tags.waterway === "sluice_gate" ||
    tags.water_control === "sluice" ||
    tags.man_made === "sluice"
  )
    return "spuisluis";
  return "onbekend";
}

function determineOperation(tags) {
  for (const key of ["lock:operation", "operation", "lock_operation"]) {
    const val = (tags[key] || "").toLowerCase();
    if (!val) continue;
    if (val.includes("manual") || val.includes("hand")) return "handmatig";
    if (val.includes("electric") || val.includes("elektr"))
      return "elektrisch";
    if (val.includes("motor")) return "motor";
    if (val.includes("remote") || val.includes("afstand"))
      return "afstandsbediening";
    if (val.includes("self") || val.includes("zelf")) return "zelfbediening";
    if (val.includes("hydraul")) return "hydraulisch";
    return val;
  }
  if (tags.manual === "yes") return "handmatig";
  if (tags.motor === "yes") return "motor";
  if (tags.self_service === "yes" || tags.self_service === "only")
    return "zelfbediening";
  if (tags.button_operated === "yes") return "drukknop";
  if (tags.automated === "yes") return "automatisch";
  return "onbekend";
}

function parseNumber(val) {
  if (!val) return null;
  const n = parseFloat(String(val).replace(",", ".").replace("m", "").trim());
  return isNaN(n) ? null : n;
}

function extractDim(tags, keys) {
  for (const k of keys) {
    const v = parseNumber(tags[k]);
    if (v !== null) return v;
  }
  return null;
}

/** Rough province assignment by bounding box. */
function determineProvince(lat, lon) {
  const provinces = [
    ["Groningen", 53.15, 53.55, 6.2, 7.1],
    ["Friesland", 52.85, 53.5, 5.0, 6.3],
    ["Drenthe", 52.6, 53.15, 6.1, 7.1],
    ["Overijssel", 52.15, 52.7, 5.7, 6.9],
    ["Flevoland", 52.2, 52.7, 5.1, 5.9],
    ["Gelderland", 51.75, 52.35, 5.0, 6.3],
    ["Utrecht", 51.9, 52.25, 4.9, 5.4],
    ["Noord-Holland", 52.2, 53.0, 4.5, 5.2],
    ["Zuid-Holland", 51.65, 52.2, 3.8, 4.9],
    ["Zeeland", 51.2, 51.75, 3.3, 4.3],
    ["Noord-Brabant", 51.2, 51.85, 4.3, 6.0],
    ["Limburg", 50.75, 51.55, 5.5, 6.25],
  ];
  for (const [name, latMin, latMax, lonMin, lonMax] of provinces) {
    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax)
      return name;
  }
  if (lat > 53.0) return lon > 6.0 ? "Groningen" : "Friesland";
  if (lat < 51.5 && lon < 4.3) return "Zeeland";
  if (lat < 51.5 && lon > 5.5) return "Limburg";
  return "Onbekend";
}

function processElement(el, nodeLookup) {
  const tags = el.tags;
  if (!tags) return null;

  let lat, lon;
  if (el.type === "node") {
    lat = el.lat;
    lon = el.lon;
  } else {
    const center = getCenterForWay(el, nodeLookup);
    if (!center) return null;
    lat = center.lat;
    lon = center.lon;
  }
  if (lat == null || lon == null) return null;

  const naam =
    tags.name || tags["name:nl"] || tags.lock_name || tags["lock:name"] || "";
  const lengte = extractDim(tags, [
    "lock:length",
    "maxlength",
    "max_length",
    "length",
  ]);
  const breedte = extractDim(tags, [
    "lock:width",
    "maxwidth",
    "max_width",
    "width",
  ]);
  const diepte = extractDim(tags, [
    "maxdraft",
    "max_draft",
    "lock:draft",
    "draft",
  ]);
  const maxhoogte = extractDim(tags, [
    "maxheight",
    "max_height",
    "lock:height",
    "height",
  ]);

  let bouwjaar = null;
  const bj = tags.start_date || tags.year;
  if (bj) {
    const parsed = parseInt(bj, 10);
    if (!isNaN(parsed) && parsed > 1000 && parsed < 2100) bouwjaar = parsed;
  }

  return {
    id: `${el.type}/${el.id}`,
    naam,
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    type: determineType(tags),
    bediening: determineOperation(tags),
    provincie: determineProvince(lat, lon),
    gemeente: null,
    lengte,
    breedte,
    diepte,
    maxhoogte,
    eigenaar: tags.operator || tags.owner || null,
    bouwjaar,
    vhf: tags.VHF || tags.vhf || null,
    openingstijden: tags.opening_hours || null,
    website: tags.website || tags.url || tags["contact:website"] || null,
    wikipedia: tags.wikipedia || tags["wikipedia:nl"] || null,
    tags: JSON.stringify(tags),
  };
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // Remove existing db to start fresh
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
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
      tags TEXT
    );

    CREATE INDEX idx_sluizen_provincie ON sluizen(provincie);
    CREATE INDEX idx_sluizen_type ON sluizen(type);
    CREATE INDEX idx_sluizen_bediening ON sluizen(bediening);
    CREATE INDEX idx_sluizen_naam ON sluizen(naam);

    CREATE TABLE statistieken (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function computeStats(sluizen) {
  const stats = {
    totaal: sluizen.length,
    datum_verwerkt: new Date().toISOString().slice(0, 10),
    bron: "OpenStreetMap via Overpass API",
  };

  // Per provincie
  const perProv = {};
  for (const s of sluizen) {
    perProv[s.provincie] = (perProv[s.provincie] || 0) + 1;
  }
  stats.per_provincie = Object.fromEntries(
    Object.entries(perProv)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, { aantal: v }])
  );

  // Per type
  const perType = {};
  for (const s of sluizen) perType[s.type] = (perType[s.type] || 0) + 1;
  stats.per_type = Object.fromEntries(
    Object.entries(perType).sort((a, b) => b[1] - a[1])
  );

  // Per bediening
  const perBed = {};
  for (const s of sluizen)
    perBed[s.bediening] = (perBed[s.bediening] || 0) + 1;
  stats.per_bediening = Object.fromEntries(
    Object.entries(perBed).sort((a, b) => b[1] - a[1])
  );

  // Size distribution
  const lengths = sluizen.map((s) => s.lengte).filter((v) => v != null);
  const widths = sluizen.map((s) => s.breedte).filter((v) => v != null);
  stats.grootteverdeling = {
    met_lengte: lengths.length,
    met_breedte: widths.length,
  };
  if (lengths.length) {
    stats.grootteverdeling.lengte_min = Math.min(...lengths);
    stats.grootteverdeling.lengte_max = Math.max(...lengths);
    stats.grootteverdeling.lengte_gemiddeld =
      Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) /
      10;
  }
  if (widths.length) {
    stats.grootteverdeling.breedte_min = Math.min(...widths);
    stats.grootteverdeling.breedte_max = Math.max(...widths);
    stats.grootteverdeling.breedte_gemiddeld =
      Math.round((widths.reduce((a, b) => a + b, 0) / widths.length) * 10) /
      10;
  }

  stats.met_naam = sluizen.filter((s) => s.naam).length;
  stats.zonder_naam = sluizen.length - stats.met_naam;
  stats.met_eigenaar = sluizen.filter((s) => s.eigenaar).length;
  stats.met_website = sluizen.filter((s) => s.website).length;
  stats.met_wikipedia = sluizen.filter((s) => s.wikipedia).length;

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Sluizen Nederland - Data Import ===\n");

  let mainData, extraData;

  // Check for local cache files first (useful when Overpass is overloaded)
  const localMain = path.join(__dirname, "..", "database", "overpass-main.json");
  const localExtra = path.join(__dirname, "..", "database", "overpass-extra.json");

  if (fs.existsSync(localMain) && process.argv.includes("--local")) {
    console.log("1. Loading main sluizen data from local cache...");
    mainData = JSON.parse(fs.readFileSync(localMain, "utf-8"));
    console.log(`   Loaded ${mainData.elements.length} elements`);

    console.log("2. Loading extra sluizen data from local cache...");
    extraData = fs.existsSync(localExtra)
      ? JSON.parse(fs.readFileSync(localExtra, "utf-8"))
      : { elements: [] };
    console.log(`   Loaded ${extraData.elements.length} elements`);
  } else {
    // 1. Fetch from Overpass
    console.log("1. Fetching main sluizen data from Overpass API...");
    mainData = await fetchOverpass(QUERY_MAIN);
    console.log(`   Received ${mainData.elements.length} elements`);
    // Cache locally
    fs.writeFileSync(localMain, JSON.stringify(mainData), "utf-8");

    console.log("2. Fetching extra sluizen data (relations, weirs)...");
    extraData = await fetchOverpass(QUERY_EXTRA);
    console.log(`   Received ${extraData.elements.length} elements`);
    fs.writeFileSync(localExtra, JSON.stringify(extraData), "utf-8");
  }

  // 2. Build node lookup
  const nodeLookup = new Map();
  for (const el of [...mainData.elements, ...extraData.elements]) {
    if (el.type === "node" && el.lat != null) {
      nodeLookup.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  // 3. Process elements
  console.log("3. Processing elements...");
  const seen = new Set();
  const sluizen = [];

  for (const el of [...mainData.elements, ...extraData.elements]) {
    if (!el.tags) continue;
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const record = processElement(el, nodeLookup);
    if (record) sluizen.push(record);
  }

  sluizen.sort((a, b) =>
    a.provincie.localeCompare(b.provincie) || a.naam.localeCompare(b.naam)
  );

  console.log(`   Processed ${sluizen.length} sluizen\n`);

  // 4. Write to SQLite
  console.log("4. Writing to SQLite database...");
  const db = initDb();

  const insert = db.prepare(`
    INSERT INTO sluizen (id, naam, lat, lon, type, bediening, provincie, gemeente,
      lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf,
      openingstijden, website, wikipedia, tags)
    VALUES (@id, @naam, @lat, @lon, @type, @bediening, @provincie, @gemeente,
      @lengte, @breedte, @diepte, @maxhoogte, @eigenaar, @bouwjaar, @vhf,
      @openingstijden, @website, @wikipedia, @tags)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(sluizen);

  // 5. Compute & store statistics
  const stats = computeStats(sluizen);

  const insertStat = db.prepare(
    "INSERT INTO statistieken (key, value) VALUES (?, ?)"
  );
  const insertStats = db.transaction((s) => {
    for (const [k, v] of Object.entries(s)) {
      insertStat.run(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  });
  insertStats(stats);

  db.close();
  console.log(`   Database saved to ${DB_PATH}`);

  // 6. Write JSON fallback
  console.log("5. Writing JSON fallback files...");
  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });

  const jsonRecords = sluizen.map(({ tags: _tags, ...rest }) => rest);
  fs.writeFileSync(JSON_PATH, JSON.stringify(jsonRecords, null, 2), "utf-8");
  console.log(`   ${JSON_PATH} (${sluizen.length} records)`);

  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), "utf-8");
  console.log(`   ${STATS_PATH}`);

  // 7. Summary
  console.log(`\n=== Import complete ===`);
  console.log(`Totaal: ${stats.totaal} sluizen`);
  console.log(`Per provincie:`);
  for (const [prov, info] of Object.entries(stats.per_provincie)) {
    console.log(`  ${prov}: ${info.aantal}`);
  }
  console.log(`Per type:`);
  for (const [t, n] of Object.entries(stats.per_type)) {
    console.log(`  ${t}: ${n}`);
  }
  console.log(`Met naam: ${stats.met_naam}, zonder naam: ${stats.zonder_naam}`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
