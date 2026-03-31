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
    _db = new Database(DB_PATH, { readonly: true });
    _db.pragma("journal_mode = WAL");
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
      categorie TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_provincie ON sluizen(provincie);
    CREATE INDEX IF NOT EXISTS idx_type ON sluizen(type);
    CREATE INDEX IF NOT EXISTS idx_bediening ON sluizen(bediening);
    CREATE INDEX IF NOT EXISTS idx_gemeente ON sluizen(gemeente);
    CREATE INDEX IF NOT EXISTS idx_eigenaar ON sluizen(eigenaar);
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
      "SELECT id, naam, lat, lon, type, bediening, provincie, gemeente, lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf, openingstijden, website, wikipedia, bron, categorie FROM sluizen ORDER BY provincie, naam"
    )
    .all() as Sluis[];
}

export function getSluisById(id: string): (Sluis & { tags: string }) | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sluizen WHERE id = ?").get(id);
  return (row as (Sluis & { tags: string }) | undefined) ?? null;
}

export function filterSluizen(filters: FilterState): Sluis[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.zoek) {
    conditions.push(
      "(naam LIKE @zoek OR provincie LIKE @zoek OR eigenaar LIKE @zoek)"
    );
    params.zoek = `%${filters.zoek}%`;
  }

  if (filters.provincie.length > 0) {
    const placeholders = filters.provincie.map((_, i) => `@prov${i}`);
    conditions.push(`provincie IN (${placeholders.join(",")})`);
    filters.provincie.forEach((p, i) => {
      params[`prov${i}`] = p;
    });
  }

  if (filters.type.length > 0) {
    const placeholders = filters.type.map((_, i) => `@type${i}`);
    conditions.push(`type IN (${placeholders.join(",")})`);
    filters.type.forEach((t, i) => {
      params[`type${i}`] = t;
    });
  }

  if (filters.bediening.length > 0) {
    const placeholders = filters.bediening.map((_, i) => `@bed${i}`);
    conditions.push(`bediening IN (${placeholders.join(",")})`);
    filters.bediening.forEach((b, i) => {
      params[`bed${i}`] = b;
    });
  }

  if (filters.eigenaar.length > 0) {
    const placeholders = filters.eigenaar.map((_, i) => `@eig${i}`);
    conditions.push(`eigenaar IN (${placeholders.join(",")})`);
    filters.eigenaar.forEach((e, i) => {
      params[`eig${i}`] = e;
    });
  }

  if (filters.gemeente.length > 0) {
    const placeholders = filters.gemeente.map((_, i) => `@gem${i}`);
    conditions.push(`gemeente IN (${placeholders.join(",")})`);
    filters.gemeente.forEach((g, i) => {
      params[`gem${i}`] = g;
    });
  }

  if (filters.categorie?.length > 0) {
    const placeholders = filters.categorie.map((_, i) => `@cat${i}`);
    conditions.push(`categorie IN (${placeholders.join(",")})`);
    filters.categorie.forEach((c, i) => {
      params[`cat${i}`] = c;
    });
  }

  if (filters.bron?.length > 0) {
    const placeholders = filters.bron.map((_, i) => `@bron${i}`);
    conditions.push(`bron IN (${placeholders.join(",")})`);
    filters.bron.forEach((b, i) => {
      params[`bron${i}`] = b;
    });
  }

  if (filters.lengteMin > 0) {
    conditions.push("(lengte IS NULL OR lengte >= @lengteMin)");
    params.lengteMin = filters.lengteMin;
  }
  if (filters.lengteMax < 500) {
    conditions.push("(lengte IS NULL OR lengte <= @lengteMax)");
    params.lengteMax = filters.lengteMax;
  }

  if (filters.breedteMin > 0) {
    conditions.push("(breedte IS NULL OR breedte >= @breedteMin)");
    params.breedteMin = filters.breedteMin;
  }
  if (filters.breedteMax < 100) {
    conditions.push("(breedte IS NULL OR breedte <= @breedteMax)");
    params.breedteMax = filters.breedteMax;
  }

  if (filters.bouwjaarMin > 1500) {
    conditions.push("(bouwjaar IS NULL OR bouwjaar >= @bouwjaarMin)");
    params.bouwjaarMin = filters.bouwjaarMin;
  }
  if (filters.bouwjaarMax < 2030) {
    conditions.push("(bouwjaar IS NULL OR bouwjaar <= @bouwjaarMax)");
    params.bouwjaarMax = filters.bouwjaarMax;
  }

  if (filters.heeftOpeningstijden) {
    conditions.push("openingstijden IS NOT NULL");
  }
  if (filters.heeftVhf) {
    conditions.push("vhf IS NOT NULL");
  }
  if (filters.heeftNaam) {
    conditions.push("naam IS NOT NULL AND naam != ''");
  }
  if (filters.heeftAfmetingen) {
    conditions.push("lengte IS NOT NULL");
  }
  if (filters.heeftBeheerder) {
    conditions.push("eigenaar IS NOT NULL AND eigenaar != ''");
  }

  let orderBy = "provincie, naam";
  if (filters.sortering === "naam") orderBy = "naam";
  else if (filters.sortering === "grootte") orderBy = "lengte DESC";

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, naam, lat, lon, type, bediening, provincie, gemeente, lengte, breedte, diepte, maxhoogte, eigenaar, bouwjaar, vhf, openingstijden, website, wikipedia, bron, categorie FROM sluizen ${where} ORDER BY ${orderBy}`;

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
  types: string[];
  categorieen: string[];
  bronnen: string[];
  bedieningen: string[];
  eigenaars: string[];
} {
  const db = getDb();
  const provincies = getUniqueValues("provincie");
  const types = getUniqueValues("type");
  const categorieen = getUniqueValues("categorie");
  const bronnen = getUniqueValues("bron");
  const bedieningen = getUniqueValues("bediening");
  const eigenaars = getUniqueValues("eigenaar");

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

  return { provincies, gemeenten, types, categorieen, bronnen, bedieningen, eigenaars };
}

export function computeStatistieken() {
  const db = getDb();

  const totaal = countSluizen();

  // Province stats with bediening breakdown
  const provRows = db
    .prepare(
      `SELECT provincie, bediening, COUNT(*) as count FROM sluizen GROUP BY provincie, bediening ORDER BY provincie`
    )
    .all() as { provincie: string; bediening: string; count: number }[];

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
      `SELECT type, COUNT(*) as count FROM sluizen GROUP BY type ORDER BY count DESC`
    )
    .all() as { type: string; count: number }[];
  const types: [string, number][] = typeRows.map((r) => [r.type, r.count]);

  // Categorie stats
  const catRows = db
    .prepare(
      `SELECT categorie, COUNT(*) as count FROM sluizen WHERE categorie IS NOT NULL AND categorie != '' GROUP BY categorie ORDER BY count DESC`
    )
    .all() as { categorie: string; count: number }[];
  const categorieen: [string, number][] = catRows.map((r) => [r.categorie, r.count]);

  // Bron stats
  const bronRows = db
    .prepare(
      `SELECT bron, COUNT(*) as count FROM sluizen WHERE bron IS NOT NULL AND bron != '' GROUP BY bron ORDER BY count DESC`
    )
    .all() as { bron: string; count: number }[];
  const bronnen: [string, number][] = bronRows.map((r) => [r.bron, r.count]);

  // Unique counts
  const uniqueProvincies = (
    db.prepare(`SELECT COUNT(DISTINCT provincie) as c FROM sluizen WHERE provincie != 'Onbekend'`).get() as { c: number }
  ).c;
  const uniqueGemeenten = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT gemeente) as c FROM sluizen WHERE gemeente IS NOT NULL AND gemeente != ''`
      )
      .get() as { c: number }
  ).c;
  const uniqueEigenaars = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT eigenaar) as c FROM sluizen WHERE eigenaar IS NOT NULL AND eigenaar != ''`
      )
      .get() as { c: number }
  ).c;

  const metNaam = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen WHERE naam IS NOT NULL AND naam != ''`).get() as { c: number }
  ).c;
  const metAfmetingen = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen WHERE lengte IS NOT NULL`).get() as { c: number }
  ).c;
  const metBeheerder = (
    db.prepare(`SELECT COUNT(*) as c FROM sluizen WHERE eigenaar IS NOT NULL AND eigenaar != ''`).get() as { c: number }
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
  };
}
