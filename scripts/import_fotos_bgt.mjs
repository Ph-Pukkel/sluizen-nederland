#!/usr/bin/env node
// import_fotos_bgt.mjs
// Zoek foto's voor onbenoemde BGT-stuwen via Wikimedia Commons geosearch
// Nauwkeurigheid staat centraal: liever weinig correcte matches dan veel twijfelachtige

import Database from 'better-sqlite3';
import { setTimeout as sleep } from 'timers/promises';
import fs from 'fs';

const DB_PATH = '/Users/macminion/sluizen-nederland/database/sluizen.db';
const PROGRESS_FILE = '/tmp/import_fotos_bgt_progress.json';
const USER_AGENT = 'SluizenNederland/1.0 (github.com/Ph-Pukkel/sluizen-nederland; contact: bot-traffic@wikimedia.org)';
const GEOSEARCH_RADIUS = 50; // meter - strikt 50m

// Rate limiting: respecteer Wikimedia's limieten
// Wikimedia staat max 200 req/min toe voor niet-geauthenticeerde bots
// We doen 2 requests per record (geosearch + fileinfo), dus 1 req/sec = 60/min totaal
let RATE_LIMIT_MS = 1000; // 1 seconde tussen requests

// Nederlandse waterstructuur-termen in titel/beschrijving
const WATER_TERMS_NL = [
  'stuw', 'sluis', 'gemaal', 'keersluis', 'waterwerk', 'spuisluis',
  'duiker', 'waterloop', 'vijver', 'kanaal', 'dam',
  'waterkering', 'pompgemaal', 'watermolen', 'sluisje', 'stuwtje',
  'overlaat', 'inlaat', 'uitlaat', 'boezem', 'polder', 'wetering',
  'vaart', 'sloot', 'rivier', 'beek', 'dijk', 'boezemgemaal'
];

// Wikimedia Commons categorieën die waterstructuren indiceren
const WATER_CATEGORIES = [
  'sluices', 'weirs', 'locks', 'pumping stations', 'water management',
  'canals', 'waterways', 'watermills', 'hydraulic structures',
  'waterways in the netherlands', 'weirs in the netherlands',
  'sluices in the netherlands', 'locks in the netherlands',
  'pumping stations in the netherlands', 'water gates',
  'flood gates', 'dams in the netherlands', 'polders',
  'drainage', 'irrigation', 'dikes', 'levees', 'embankments',
  'dutch water management', 'waterbeheer', 'waterkeringen', 'gemalen', 'stuwen',
  'hydraulic', 'waterwork', 'water board', 'waterschappen'
];

function containsWaterTerm(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return WATER_TERMS_NL.some(term => lower.includes(term));
}

function containsWaterCategory(categories) {
  if (!categories || !Array.isArray(categories)) return false;
  return categories.some(cat => {
    const lower = cat.toLowerCase();
    return WATER_CATEGORIES.some(wc => lower.includes(wc));
  });
}

// Tijdstip van laatste request, voor rate limiting
let lastRequestTime = 0;

async function apiRequest(url, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Zorg dat we niet sneller gaan dan rate limit
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await sleep(RATE_LIMIT_MS - elapsed);
    }
    lastRequestTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = parseInt(retryAfterHeader || '30');
        // Begrens op 5 minuten per poging; na 4 pogingen geven we op
        const waitMs = Math.min(retryAfter * 1000, 300000);
        console.warn(`  Rate limited (429), Retry-After=${retryAfter}s. Wacht ${Math.round(waitMs/1000)}s...`);
        if (waitMs > 60000) {
          console.warn(`  (lange wacht: ${Math.round(waitMs/60000)} minuten)`);
        }
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      if (err.message?.startsWith('HTTP')) throw err;
      if (attempt === retries) throw err;
      const wait = 3000 * attempt;
      console.warn(`  Poging ${attempt} mislukt (${err.message}), retry in ${wait/1000}s...`);
      await sleep(wait);
    }
  }
  throw new Error(`Alle ${retries} pogingen mislukt`);
}

async function geosearch(lat, lon) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${GEOSEARCH_RADIUS}&gsnamespace=6&gsprop=type|name|dim|country&gslimit=10&format=json`;
  const data = await apiRequest(url);
  return data?.query?.geosearch || [];
}

async function getFileInfo(title) {
  // Haal imageinfo (thumbnail + beschrijving) en categorieën op in één request
  const encoded = encodeURIComponent(title);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encoded}&prop=imageinfo|categories&iiprop=url|extmetadata&iiurlwidth=600&cllimit=50&format=json`;
  const data = await apiRequest(url);

  const pages = data?.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;

  const imageinfo = page.imageinfo?.[0];
  if (!imageinfo) return null;

  const categories = (page.categories || []).map(c => c.title.replace('Category:', ''));
  const thumbUrl = imageinfo.thumburl;
  const descriptionUrl = imageinfo.descriptionurl;

  // Haal metadata op voor titel en beschrijving
  const meta = imageinfo.extmetadata || {};
  const imageTitle = meta.ObjectName?.value || meta['Object Name']?.value || '';
  // Strip HTML-tags uit beschrijving
  const rawDesc = meta.ImageDescription?.value || '';
  const imageDesc = rawDesc.replace(/<[^>]*>/g, ' ');

  return {
    thumbUrl,
    descriptionUrl,
    categories,
    imageTitle,
    imageDesc
  };
}

function isValidWaterPhoto(fileTitle, fileInfo) {
  if (!fileInfo) return { valid: false, reason: 'geen fileinfo' };

  // Check 1: bevat de bestandsnaam een waterterm?
  // Verwijder pad-prefix "File:" voor de check
  const cleanTitle = fileTitle.replace(/^File:/i, '');
  const titleHasWater = containsWaterTerm(cleanTitle);

  // Check 2: bevat de metadata een waterterm?
  const descHasWater = containsWaterTerm(fileInfo.imageTitle) ||
                       containsWaterTerm(fileInfo.imageDesc);

  // Check 3: bevat een categorie een waterterm?
  const catHasWater = containsWaterCategory(fileInfo.categories);

  const score = (titleHasWater ? 1 : 0) + (descHasWater ? 1 : 0) + (catHasWater ? 1 : 0);

  // Strenge validatieregels voor naamloze structuren:
  if (catHasWater) {
    // Categorie-match is sterkste signaal
    return { valid: true, reason: `categorie match (score ${score}/3)`, score };
  }
  if (score >= 2) {
    return { valid: true, reason: `${score}/3 checks (titel+desc)`, score };
  }

  // Slechts één signaal: afwijzen voor naamloze structuren
  return { valid: false, reason: `score ${score}/3 (te onzeker)`, score };
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch {}
  return { processedIds: [], found: 0, updated: 0 };
}

function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (err) {
    console.warn(`Kon voortgang niet opslaan: ${err.message}`);
  }
}

async function processBatch(records, dryRun = false, resumeProgress = null) {
  const db = new Database(DB_PATH);
  const updateStmt = db.prepare(
    'UPDATE sluizen SET foto_url = ?, foto_bron = ? WHERE id = ?'
  );

  let processed = 0;
  let found = resumeProgress?.found || 0;
  let updated = resumeProgress?.updated || 0;
  let skipped = 0;
  let errors = 0;
  const examples = [];
  const processedIds = new Set(resumeProgress?.processedIds || []);

  // Sla periodiek voortgang op
  let lastSave = Date.now();

  for (const record of records) {
    // Sla al verwerkte records over bij herstart
    if (processedIds.has(record.id)) {
      continue;
    }

    processed++;

    if (processed % 50 === 0) {
      const pct = ((processedIds.size + processed) / (records.length + processedIds.size) * 100).toFixed(1);
      console.log(`  [${processed}/${records.length}] ${pct}% | gevonden: ${found}, bijgewerkt: ${updated}, fouten: ${errors}`);
    }

    try {
      // Stap 1: geosearch binnen 50m
      const hits = await geosearch(record.lat, record.lon);

      if (hits.length === 0) {
        skipped++;
        processedIds.add(record.id);
        continue;
      }

      // Stap 2: valideer elk resultaat
      let bestMatch = null;

      for (const hit of hits) {
        const fileTitle = hit.title; // bijv. "File:Stuw Beatrixkanaal.jpg"

        // Haal fileinfo op
        const fileInfo = await getFileInfo(fileTitle);

        if (!fileInfo?.thumbUrl) continue;

        const validation = isValidWaterPhoto(fileTitle, fileInfo);

        if (validation.valid) {
          bestMatch = { hit, fileInfo, validation, fileTitle };
          break;
        } else if (dryRun) {
          console.log(`    AFGEWEZEN: ${fileTitle}`);
          console.log(`      Reden: ${validation.reason}`);
          console.log(`      Cats: ${fileInfo.categories.slice(0, 3).join(', ')}`);
        }
      }

      if (bestMatch) {
        found++;
        const { fileInfo, validation, fileTitle } = bestMatch;

        const example = {
          id: record.id,
          categorie: record.categorie,
          lat: record.lat,
          lon: record.lon,
          fileTitle,
          thumbUrl: fileInfo.thumbUrl,
          categories: fileInfo.categories.slice(0, 4).join(', '),
          reason: validation.reason
        };

        // Bouw URL in hetzelfde formaat als bestaande geosearch-records
        // bijv: https://commons.wikimedia.org/wiki/Special:FilePath/Stuw.jpg?width=400
        const cleanName = fileTitle.replace(/^File:/i, '');
        const fotoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanName)}?width=400`;
        const fotoBron = 'wikimedia_commons_geosearch';

        if (dryRun) {
          console.log(`\n  MATCH: ${record.id} (${record.categorie} @ ${record.lat},${record.lon})`);
          console.log(`    Bestand:   ${fileTitle}`);
          console.log(`    Foto URL:  ${fotoUrl}`);
          console.log(`    Cats:      ${fileInfo.categories.slice(0, 5).join(' | ')}`);
          console.log(`    Reden:     ${validation.reason}`);
          console.log(`    Commons:   ${fileInfo.descriptionUrl}`);
        } else {
          updateStmt.run(fotoUrl, fotoBron, record.id);
          updated++;
        }

        // Update example URL ook
        example.thumbUrl = fotoUrl;

        if (examples.length < 15) {
          examples.push(example);
        }
      }

      processedIds.add(record.id);

      // Sla voortgang op elke 5 minuten
      if (!dryRun && Date.now() - lastSave > 300000) {
        saveProgress({ processedIds: [...processedIds], found, updated });
        lastSave = Date.now();
        console.log(`  [voortgang opgeslagen: ${updated} updates]`);
      }

    } catch (err) {
      errors++;
      console.error(`  FOUT bij ${record.id}: ${err.message}`);
      await sleep(2000);
    }
  }

  db.close();

  // Verwijder progress file na succesvolle voltooiing
  if (!dryRun) {
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
  }

  return { processed, found, updated, skipped, errors, examples };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const resume = args.includes('--resume');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5000');

  // Optioneel: andere rate limit via CLI
  const rateArg = args.find(a => a.startsWith('--rate='));
  if (rateArg) {
    RATE_LIMIT_MS = parseInt(rateArg.split('=')[1]);
  }

  console.log('=== BGT Foto Import via Wikimedia Commons Geosearch ===');
  console.log(`Modus:      ${dryRun ? 'DRY-RUN (geen database-updates)' : 'LIVE (schrijft naar database)'}`);
  console.log(`Limiet:     ${limit} records`);
  console.log(`Radius:     ${GEOSEARCH_RADIUS}m`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms tussen requests`);
  console.log(`Hervatten:  ${resume ? 'ja' : 'nee'}`);
  console.log('');

  // Laad eventuele voortgang
  const resumeProgress = resume ? loadProgress() : null;
  if (resumeProgress?.processedIds?.length) {
    console.log(`Hervatten: ${resumeProgress.processedIds.length} records al verwerkt, ${resumeProgress.updated} al bijgewerkt`);
  }

  // Haal records op
  const db = new Database(DB_PATH, { readonly: true });
  const records = db.prepare(`
    SELECT id, lat, lon, categorie
    FROM sluizen
    WHERE bron='bgt'
      AND foto_url IS NULL
      AND (naam IS NULL OR naam='')
      AND categorie IN ('stuw','gemaal','sluis','schutsluis','spuisluis')
      AND lat IS NOT NULL
      AND lon IS NOT NULL
    ORDER BY categorie, id
    LIMIT ?
  `).all(limit);
  db.close();

  console.log(`${records.length} records geladen uit database`);
  console.log('Starten...\n');

  const startTime = Date.now();
  const result = await processBatch(records, dryRun, resumeProgress);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== RESULTAAT ===');
  console.log(`Verwerkt:    ${result.processed} in deze run`);
  console.log(`Gevonden:    ${result.found} potentiële matches`);
  console.log(`Bijgewerkt:  ${result.updated} records in database`);
  console.log(`Geen hits:   ${result.skipped} (geen foto binnen 50m)`);
  console.log(`Fouten:      ${result.errors}`);
  console.log(`Tijd:        ${elapsed}s`);
  console.log(`Match ratio: ${result.processed > 0 ? ((result.found/result.processed)*100).toFixed(1) : 0}%`);

  if (result.examples.length > 0) {
    console.log('\n=== VOORBEELDEN ===');
    for (const ex of result.examples) {
      console.log(`\n${ex.id} (${ex.categorie})`);
      console.log(`  Coords:   ${ex.lat}, ${ex.lon}`);
      console.log(`  Bestand:  ${ex.fileTitle}`);
      console.log(`  Cats:     ${ex.categories}`);
      console.log(`  Reden:    ${ex.reason}`);
      console.log(`  URL:      ${ex.thumbUrl}`);
    }
  }
}

main().catch(err => {
  console.error('Fatale fout:', err);
  process.exit(1);
});
