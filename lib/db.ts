import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Sluis, FilterState } from "./types";

// Prefer the deploy (compact) database; fall back to full database
const DB_DEPLOY = path.join(process.cwd(), "database", "sluizen_deploy.db");
const DB_FULL = path.join(process.cwd(), "database", "sluizen.db");
const DB_PATH = fs.existsSync(DB_DEPLOY) ? DB_DEPLOY : DB_FULL;

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    if (!fs.existsSync(DB_PATH)) {
      initializeDatabaseFromJson();
    }
    _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return _db;
}

function initializeDatabaseFromJson() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const writeDb = new Database(DB_PATH);
  writeDb.pragma("journal_mode = WAL");

  writeDb.exec(`
    CREATE TABLE IF NOT EXISTS sluizen (
      id TEXT PRIMARY KEY,
      naam TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      bediening TEXT NOT NULL DEFAULT 'onbekend',
      provincie TEXT NOT NULL DEFAULT '',
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
      tags TEXT,
      bron TEXT,
      categorie TEXT,
      foto_url TEXT,
      foto_bron TEXT,
      beschrijving TEXT,
      beheerder TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_provincie ON sluizen(provincie);
    CREATE INDEX IF NOT EXISTS idx_type ON sluizen(type);
    CREATE INDEX IF NOT EXISTS idx_bediening ON sluizen(bediening);
    CREATE INDEX IF NOT EXISTS idx_gemeente ON sluizen(gemeente);
    CREATE INDEX IF NOT EXISTS idx_eigenaar ON sluizen(eigenaar);
    CREATE INDEX IF NOT EXISTS idx_latlon ON sluizen(lat, lon);
  `);

  const jsonPath = path.join(process.cwd(), "public", "data", "sluizen.json");
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const insert = writeDb.prepare(`
      INSERT OR REPLACE INTO sluizen
        (id, naam, lat, lon, type, bediening, provincie, gemeente, lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf, openingstijden, website, wikipedia)
      VALUES
        (@id, @naam, @lat, @lon, @type, @bediening, @provincie, @gemeente, @lengte, @breedte, @diepte, @maxhoogte, @eigenaar, @bouwjaar, @vhf, @openingstijden, @website, @wikipedia)
    `);

    const insertMany = writeDb.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        insert.run({
          id: row.id,
          naam: row.naam ?? "",
          lat: row.lat,
          lon: row.lon,
          type: row.type ?? "",
          bediening: row.bediening ?? "onbekend",
          provincie: row.provincie ?? "",
          gemeente: row.gemeente ?? null,
          lengte: row.lengte ?? null,
          breedte: row.breedte ?? null,
          diepte: row.diepte ?? null,
          maxhoogte: row.maxhoogte ?? null,
          eigenaar: row.eigenaar ?? null,
          bouwjaar: row.bouwjaar ?? null,
          vhf: row.vhf ?? null,
          openingstijden: row.openingstijden ?? null,
          website: row.website ?? null,
          wikipedia: row.wikipedia ?? null,
        });
      }
    });

    insertMany(data);
  }

  writeDb.close();
}

export function getAllSluizen(): Sluis[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, naam, lat, lon, type, bediening, provincie, gemeente, lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf, openingstijden, website, wikipedia, bron, categorie, foto_url, foto_bron, beschrijving, beheerder FROM sluizen ORDER BY provincie, naam"
    )
    .all() as Sluis[];
}

export function getSluisById(id: string): (Sluis & { tags: string }) | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sluizen WHERE id = ?").get(id);
  return (row as (Sluis & { tags: string }) | undefined) ?? null;
}

export function countFilteredSluizen(filters: FilterState, bounds?: Bounds): number {
  const db = getDb();
  const { where, params } = buildWhereClause(filters, bounds);
  const row = db.prepare(`SELECT COUNT(*) as c FROM sluizen ${where}`).get(params) as { c: number };
  return row.c;
}

export function filterSluizen(filters: FilterState, limit?: number, offset?: number, bounds?: Bounds): Sluis[] {
  const db = getDb();
  const { where, params } = buildWhereClause(filters, bounds);

  let orderBy = "provincie, naam";
  if (filters.sortering === "naam") orderBy = "naam";
  else if (filters.sortering === "grootte") orderBy = "lengte DESC";

  const limitClause = limit != null ? ` LIMIT ${limit}` : "";
  const offsetClause = offset != null && offset > 0 ? ` OFFSET ${offset}` : "";
  const sql = `SELECT id, naam, lat, lon, type, bediening, provincie, gemeente, lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf, openingstijden, website, wikipedia, bron, categorie, foto_url, foto_bron, beschrijving, beheerder FROM sluizen ${where} ORDER BY ${orderBy}${limitClause}${offsetClause}`;

  return db.prepare(sql).all(params) as Sluis[];
}

export function getStatistiek(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM statistieken WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getAllStatistieken(): Record<string, unknown> {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM statistieken")
    .all() as { key: string; value: string }[];
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return result;
}

export function getUniqueValues(column: string): string[] {
  const db = getDb();
  const allowed = [
    "type",
    "bediening",
    "provincie",
    "eigenaar",
    "gemeente",
    "categorie",
    "bron",
  ];
  if (!allowed.includes(column)) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT ${column} FROM sluizen WHERE ${column} IS NOT NULL AND ${column} != '' ORDER BY ${column}`
    )
    .all() as Record<string, string>[];
  return rows.map((r) => r[column]);
}

export function countSluizen(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM sluizen").get() as {
    count: number;
  };
  return row.count;
}

export function getFilterOptions(provincie?: string[]): {
  provincies: string[];
  gemeenten: string[];
  categorieen: string[];
  bronnen: string[];
  waterschappen: string[];
  eigenaars: string[];
} {
  const db = getDb();
  const provincies = getUniqueValues("provincie");
  const categorieen = getUniqueValues("categorie");
  const bronnen = getUniqueValues("bron");
  const eigenaars = getUniqueValues("eigenaar");
  const waterschappen = getUniqueValues("beheerder");

  let gemeenten: string[];
  if (provincie && provincie.length > 0) {
    const placeholders = provincie.map((_, i) => `@p${i}`);
    const params: Record<string, string> = {};
    provincie.forEach((p, i) => { params[`p${i}`] = p; });
    const rows = db
      .prepare(
        `SELECT DISTINCT gemeente FROM sluizen WHERE gemeente IS NOT NULL AND gemeente != '' AND provincie IN (${placeholders.join(",")}) ORDER BY gemeente`
      )
      .all(params) as { gemeente: string }[];
    gemeenten = rows.map((r) => r.gemeente);
  } else {
    gemeenten = getUniqueValues("gemeente");
  }

  return { provincies, gemeenten, categorieen, bronnen, waterschappen, eigenaars };
}

export interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

function buildWhereClause(filters?: FilterState, bounds?: Bounds): { where: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (bounds) {
    conditions.push("lat BETWEEN @minLat AND @maxLat");
    conditions.push("lon BETWEEN @minLon AND @maxLon");
    params.minLat = bounds.minLat;
    params.maxLat = bounds.maxLat;
    params.minLon = bounds.minLon;
    params.maxLon = bounds.maxLon;
  }

  if (!filters) {
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, params };
  }

  if (filters.zoek) {
    conditions.push("(naam LIKE @zoek OR provincie LIKE @zoek OR eigenaar LIKE @zoek OR gemeente LIKE @zoek OR beschrijving LIKE @zoek)");
    params.zoek = `%${filters.zoek}%`;
  }
  if (filters.provincie.length > 0) {
    const ph = filters.provincie.map((_, i) => `@fp${i}`);
    conditions.push(`provincie IN (${ph.join(",")})`);
    filters.provincie.forEach((p, i) => { params[`fp${i}`] = p; });
  }
  if (filters.gemeente.length > 0) {
    const ph = filters.gemeente.map((_, i) => `@fg${i}`);
    conditions.push(`gemeente IN (${ph.join(",")})`);
    filters.gemeente.forEach((g, i) => { params[`fg${i}`] = g; });
  }
  if (filters.categorie.length > 0) {
    const ph = filters.categorie.map((_, i) => `@fc${i}`);
    conditions.push(`categorie IN (${ph.join(",")})`);
    filters.categorie.forEach((c, i) => { params[`fc${i}`] = c; });
  }
  if (filters.bron.length > 0) {
    const ph = filters.bron.map((_, i) => `@fb${i}`);
    conditions.push(`bron IN (${ph.join(",")})`);
    filters.bron.forEach((b, i) => { params[`fb${i}`] = b; });
  }
  if (filters.waterschap.length > 0) {
    const ph = filters.waterschap.map((_, i) => `@fw${i}`);
    conditions.push(`beheerder IN (${ph.join(",")})`);
    filters.waterschap.forEach((w, i) => { params[`fw${i}`] = w; });
  }
  if (filters.eigenaar.length > 0) {
    const ph = filters.eigenaar.map((_, i) => `@fe${i}`);
    conditions.push(`eigenaar IN (${ph.join(",")})`);
    filters.eigenaar.forEach((e, i) => { params[`fe${i}`] = e; });
  }
  if (filters.lengteMin > 0) {
    conditions.push("(lengte IS NULL OR lengte >= @flmin)");
    params.flmin = filters.lengteMin;
  }
  if (filters.lengteMax < 500) {
    conditions.push("(lengte IS NULL OR lengte <= @flmax)");
    params.flmax = filters.lengteMax;
  }
  if (filters.breedteMin > 0) {
    conditions.push("(breedte IS NULL OR breedte >= @fbmin)");
    params.fbmin = filters.breedteMin;
  }
  if (filters.breedteMax < 100) {
    conditions.push("(breedte IS NULL OR breedte <= @fbmax)");
    params.fbmax = filters.breedteMax;
  }
  if (filters.bouwjaarMin > 1500) {
    conditions.push("(bouwjaar IS NULL OR bouwjaar >= @fbjmin)");
    params.fbjmin = filters.bouwjaarMin;
  }
  if (filters.bouwjaarMax < 2030) {
    conditions.push("(bouwjaar IS NULL OR bouwjaar <= @fbjmax)");
    params.fbjmax = filters.bouwjaarMax;
  }
  if (filters.heeftOpeningstijden) conditions.push("openingstijden IS NOT NULL");
  if (filters.heeftVhf) conditions.push("vhf IS NOT NULL");
  if (filters.heeftNaam) conditions.push("naam IS NOT NULL AND naam != ''");
  if (filters.heeftAfmetingen) conditions.push("lengte IS NOT NULL");
  if (filters.heeftBeheerder) conditions.push("eigenaar IS NOT NULL AND eigenaar != ''");

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export function computeStatistieken(filters?: FilterState) {
  const db = getDb();
  const { where, params } = buildWhereClause(filters);

  const totaal = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen ${where}`).get(params) as { c: number }
  ).c;

  // Province stats with bediening breakdown
  const provRows = db
    .prepare(
      `SELECT provincie, bediening, COUNT(*) as count FROM sluizen ${where} GROUP BY provincie, bediening ORDER BY provincie`
    )
    .all(params) as { provincie: string; bediening: string; count: number }[];

  const bedieningTypes = [...new Set(provRows.map((r) => r.bediening))].sort();

  const provMap = new Map<string, Record<string, string | number>>();
  for (const row of provRows) {
    let p = provMap.get(row.provincie);
    if (!p) {
      p = { naam: row.provincie, totaal: 0 };
      provMap.set(row.provincie, p);
    }
    p[row.bediening] = (p[row.bediening] as number || 0) + row.count;
    p.totaal = (p.totaal as number) + row.count;
  }
  const provincies = Array.from(provMap.values()).sort(
    (a, b) => (b.totaal as number) - (a.totaal as number)
  );

  // Type stats
  const typeRows = db
    .prepare(
      `SELECT type, COUNT(*) as count FROM sluizen ${where} GROUP BY type ORDER BY count DESC`
    )
    .all(params) as { type: string; count: number }[];
  const types: [string, number][] = typeRows.map((r) => [r.type, r.count]);

  // Categorie stats
  const catWhere = where
    ? `${where} AND categorie IS NOT NULL AND categorie != ''`
    : "WHERE categorie IS NOT NULL AND categorie != ''";
  const catRows = db
    .prepare(
      `SELECT categorie, COUNT(*) as count FROM sluizen ${catWhere} GROUP BY categorie ORDER BY count DESC`
    )
    .all(params) as { categorie: string; count: number }[];
  const categorieen: [string, number][] = catRows.map((r) => [r.categorie, r.count]);

  // Bron stats
  const bronWhere = where
    ? `${where} AND bron IS NOT NULL AND bron != ''`
    : "WHERE bron IS NOT NULL AND bron != ''";
  const bronRows = db
    .prepare(
      `SELECT bron, COUNT(*) as count FROM sluizen ${bronWhere} GROUP BY bron ORDER BY count DESC`
    )
    .all(params) as { bron: string; count: number }[];
  const bronnen: [string, number][] = bronRows.map((r) => [r.bron, r.count]);

  // Unique counts
  const provWhere = where
    ? `${where} AND provincie != 'Onbekend'`
    : "WHERE provincie != 'Onbekend'";
  const uniqueProvincies = (
    db.prepare(`SELECT COUNT(DISTINCT provincie) as c FROM sluizen ${provWhere}`).get(params) as { c: number }
  ).c;

  const gemWhere = where
    ? `${where} AND gemeente IS NOT NULL AND gemeente != ''`
    : "WHERE gemeente IS NOT NULL AND gemeente != ''";
  const uniqueGemeenten = (
    db.prepare(`SELECT COUNT(DISTINCT gemeente) as c FROM sluizen ${gemWhere}`).get(params) as { c: number }
  ).c;

  const eigWhere = where
    ? `${where} AND eigenaar IS NOT NULL AND eigenaar != ''`
    : "WHERE eigenaar IS NOT NULL AND eigenaar != ''";
  const uniqueEigenaars = (
    db.prepare(`SELECT COUNT(DISTINCT eigenaar) as c FROM sluizen ${eigWhere}`).get(params) as { c: number }
  ).c;

  const naamWhere = where
    ? `${where} AND naam IS NOT NULL AND naam != ''`
    : "WHERE naam IS NOT NULL AND naam != ''";
  const metNaam = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen ${naamWhere}`).get(params) as { c: number }
  ).c;

  const afmWhere = where
    ? `${where} AND lengte IS NOT NULL`
    : "WHERE lengte IS NOT NULL";
  const metAfmetingen = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen ${afmWhere}`).get(params) as { c: number }
  ).c;

  const behWhere = where
    ? `${where} AND beheerder IS NOT NULL AND beheerder != ''`
    : "WHERE beheerder IS NOT NULL AND beheerder != ''";
  const metBeheerder = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen ${behWhere}`).get(params) as { c: number }
  ).c;

  const fotoWhere = where
    ? `${where} AND foto_url IS NOT NULL`
    : "WHERE foto_url IS NOT NULL";
  const metFoto = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen ${fotoWhere}`).get(params) as { c: number }
  ).c;

  return {
    totaal,
    provincies,
    bedieningTypes,
    types,
    categorieen,
    bronnen,
    uniqueProvincies,
    uniqueGemeenten,
    uniqueEigenaars,
    metNaam,
    metAfmetingen,
    metBeheerder,
    metFoto,
    provincieDetails: getProvincieDetailStatsInternal(where, params),
  };
}

function getProvincieDetailStatsInternal(where: string, params: Record<string, unknown>) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT
       provincie,
       COUNT(*) as totaal,
       SUM(CASE WHEN naam IS NOT NULL AND naam != '' THEN 1 ELSE 0 END) as metNaam,
       SUM(CASE WHEN lengte IS NOT NULL THEN 1 ELSE 0 END) as metAfmetingen
     FROM sluizen ${where}
     GROUP BY provincie
     ORDER BY COUNT(*) DESC`
  ).all(params) as { provincie: string; totaal: number; metNaam: number; metAfmetingen: number }[];
  return rows;
}

export function getFeaturedSluizen(limit = 6): Sluis[] {
  const db = getDb();
  return db.prepare(
    `SELECT id, naam, lat, lon, type, bediening, provincie, gemeente, lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf, openingstijden, website, wikipedia, bron, categorie, foto_url, foto_bron, beschrijving, beheerder
     FROM sluizen
     WHERE foto_url IS NOT NULL AND naam IS NOT NULL AND naam != ''
     ORDER BY
       CASE WHEN wikipedia IS NOT NULL AND wikipedia != '' THEN 0 ELSE 1 END,
       naam
     LIMIT ?`
  ).all(limit) as Sluis[];
}

export function getProvincieDetailStats(filters?: FilterState) {
  const db = getDb();
  const { where, params } = buildWhereClause(filters);

  const rows = db.prepare(
    `SELECT
       provincie,
       COUNT(*) as totaal,
       SUM(CASE WHEN naam IS NOT NULL AND naam != '' THEN 1 ELSE 0 END) as metNaam,
       SUM(CASE WHEN lengte IS NOT NULL THEN 1 ELSE 0 END) as metAfmetingen
     FROM sluizen ${where}
     GROUP BY provincie
     ORDER BY COUNT(*) DESC`
  ).all(params) as { provincie: string; totaal: number; metNaam: number; metAfmetingen: number }[];

  return rows;
}
