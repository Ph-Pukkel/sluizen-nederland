# Scripts

## Data Import (`npm run import`)

Haalt alle sluizen in Nederland op uit OpenStreetMap via de Overpass API en slaat ze op in een lokale SQLite database.

### Gebruik

```bash
# Haal data op via Overpass API en importeer in SQLite
npm run import

# Gebruik lokaal gecachte Overpass data (als de API overbelast is)
npm run import -- --local
```

### Wat doet het script?

1. Bevraagt de Overpass API met twee queries:
   - Alle sluizen (lock, lock_gate, sluice_gate, sluice, etc.)
   - Extra structuren (stuwen met sluis, relaties)
2. Verwerkt de ruwe OSM data en extraheert metadata (naam, locatie, type, afmetingen, beheerder, etc.)
3. Slaat alles op in `database/sluizen.db` (SQLite)
4. Schrijft ook JSON fallback bestanden naar `public/data/`

### Database schema

De `sluizen` tabel bevat:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | TEXT (PK) | OSM type/id (bijv. "way/12345") |
| naam | TEXT | Naam van de sluis |
| lat, lon | REAL | Coordinaten |
| type | TEXT | schutsluis, sluisdeur, spuisluis |
| bediening | TEXT | handmatig, elektrisch, zelfbediening, onbekend, etc. |
| provincie | TEXT | Provincie (geschat op basis van coordinaten) |
| gemeente | TEXT | Gemeente (indien beschikbaar) |
| lengte, breedte | REAL | Afmetingen in meters |
| diepte, maxhoogte | REAL | Diepgang/hoogte in meters |
| eigenaar | TEXT | Beheerder/operator |
| bouwjaar | INTEGER | Bouwjaar |
| vhf | TEXT | VHF kanaal |
| openingstijden | TEXT | Openingstijden |
| website | TEXT | Website URL |
| wikipedia | TEXT | Wikipedia referentie |
| tags | TEXT | Alle originele OSM tags als JSON |

### Overpass API cache

Bij de eerste run worden de Overpass responses opgeslagen in `database/overpass-main.json` en `database/overpass-extra.json`. Als de Overpass API overbelast is, kun je `--local` gebruiken om de gecachte data te importeren.

### Hoe vaak verversen?

OSM data verandert niet heel snel voor sluizen. Een maandelijkse import is voldoende. Draai `npm run import` zonder `--local` om verse data op te halen.
