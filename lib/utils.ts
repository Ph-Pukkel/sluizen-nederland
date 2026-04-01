import { Sluis, FilterState, FilterOptions, Statistieken, defaultFilters, overzichtDefaultFilters } from './types';

// --- API client functions (used by client components) ---

export interface SluizenResponse {
  data: Sluis[];
  total_count: number;
  limit: number;
  offset: number;
}

export interface MapBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export async function fetchSluizen(filters?: FilterState, limit?: number, offset?: number, bounds?: MapBounds): Promise<SluizenResponse> {
  const params = filters ? filtersToSearchParams(filters) : new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null && offset > 0) params.set('offset', String(offset));
  if (bounds) params.set('bounds', `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`);
  const query = params.toString();
  const url = query ? `/api/sluizen?${query}` : '/api/sluizen';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('API fout');
    return await res.json() as SluizenResponse;
  } catch {
    return { data: [], total_count: 0, limit: limit ?? 10000, offset: offset ?? 0 };
  }
}

export async function fetchSluis(id: string): Promise<Sluis | null> {
  try {
    const encodedId = id.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`/api/sluizen/${encodedId}`);
    if (!res.ok) return null;
    return await res.json() as Sluis;
  } catch {
    return null;
  }
}

export async function fetchFilterOptions(provincies?: string[]): Promise<FilterOptions> {
  const params = new URLSearchParams();
  params.set('options', 'true');
  if (provincies) {
    provincies.forEach((p) => params.append('provincie', p));
  }
  try {
    const res = await fetch(`/api/sluizen?${params.toString()}`);
    if (!res.ok) throw new Error('API fout');
    return await res.json() as FilterOptions;
  } catch {
    return { provincies: [], gemeenten: [], waterschappen: [], categorieen: [], bronnen: [], eigenaars: [] };
  }
}

export async function fetchStatistieken(filters?: FilterState): Promise<Statistieken | null> {
  try {
    const params = filters ? filtersToSearchParams(filters) : new URLSearchParams();
    const query = params.toString();
    const url = query ? `/api/statistieken?${query}` : '/api/statistieken';
    const res = await fetch(url);
    if (!res.ok) throw new Error('API fout');
    return await res.json() as Statistieken;
  } catch {
    return null;
  }
}

export async function fetchFeatured(): Promise<Sluis[]> {
  try {
    const res = await fetch('/api/featured');
    if (!res.ok) return [];
    return await res.json() as Sluis[];
  } catch {
    return [];
  }
}

export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.zoek) params.set('zoek', filters.zoek);
  filters.provincie.forEach((v) => params.append('provincie', v));
  filters.gemeente.forEach((v) => params.append('gemeente', v));
  filters.categorie.forEach((v) => params.append('categorie', v));
  filters.bron.forEach((v) => params.append('bron', v));
  filters.waterschap.forEach((v) => params.append('waterschap', v));
  filters.eigenaar.forEach((v) => params.append('eigenaar', v));
  if (filters.lengteMin > 0) params.set('lengteMin', String(filters.lengteMin));
  if (filters.lengteMax < 500) params.set('lengteMax', String(filters.lengteMax));
  if (filters.breedteMin > 0) params.set('breedteMin', String(filters.breedteMin));
  if (filters.breedteMax < 100) params.set('breedteMax', String(filters.breedteMax));
  if (filters.bouwjaarMin > 1500) params.set('bouwjaarMin', String(filters.bouwjaarMin));
  if (filters.bouwjaarMax < 2030) params.set('bouwjaarMax', String(filters.bouwjaarMax));
  if (filters.heeftOpeningstijden) params.set('heeftOpeningstijden', 'true');
  if (filters.heeftVhf) params.set('heeftVhf', 'true');
  if (filters.heeftNaam) params.set('heeftNaam', 'true');
  if (filters.heeftAfmetingen) params.set('heeftAfmetingen', 'true');
  if (filters.heeftBeheerder) params.set('heeftBeheerder', 'true');
  if (filters.sortering !== 'naam') params.set('sortering', filters.sortering);
  return params;
}

export function searchParamsToFilters(searchParams: URLSearchParams): FilterState {
  return {
    zoek: searchParams.get('zoek') || '',
    provincie: searchParams.getAll('provincie'),
    gemeente: searchParams.getAll('gemeente'),
    categorie: searchParams.getAll('categorie'),
    bron: searchParams.getAll('bron'),
    waterschap: searchParams.getAll('waterschap'),
    eigenaar: searchParams.getAll('eigenaar'),
    lengteMin: Number(searchParams.get('lengteMin')) || 0,
    lengteMax: Number(searchParams.get('lengteMax')) || 500,
    breedteMin: Number(searchParams.get('breedteMin')) || 0,
    breedteMax: Number(searchParams.get('breedteMax')) || 100,
    bouwjaarMin: Number(searchParams.get('bouwjaarMin')) || 1500,
    bouwjaarMax: Number(searchParams.get('bouwjaarMax')) || 2030,
    heeftOpeningstijden: searchParams.get('heeftOpeningstijden') === 'true',
    heeftVhf: searchParams.get('heeftVhf') === 'true',
    heeftNaam: searchParams.get('heeftNaam') === 'true',
    heeftAfmetingen: searchParams.get('heeftAfmetingen') === 'true',
    heeftBeheerder: searchParams.get('heeftBeheerder') === 'true',
    sortering: (searchParams.get('sortering') as FilterState['sortering']) || 'naam',
  };
}

// Check if filters differ from defaults (to decide if we need query params)
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.zoek !== '' ||
    filters.provincie.length > 0 ||
    filters.gemeente.length > 0 ||
    filters.categorie.length > 0 ||
    filters.bron.length > 0 ||
    filters.waterschap.length > 0 ||
    filters.eigenaar.length > 0 ||
    filters.lengteMin > 0 ||
    filters.lengteMax < 500 ||
    filters.breedteMin > 0 ||
    filters.breedteMax < 100 ||
    filters.bouwjaarMin > 1500 ||
    filters.bouwjaarMax < 2030 ||
    filters.heeftOpeningstijden ||
    filters.heeftVhf ||
    filters.heeftNaam ||
    filters.heeftAfmetingen ||
    filters.heeftBeheerder
  );
}

// --- Display helpers (used by both client and server) ---

export function bedieningLabel(b: string): string {
  const labels: Record<string, string> = {
    zelfbediening: 'Zelfbediening',
    drukknop: 'Drukknop',
    handmatig: 'Handmatig',
    elektrisch: 'Elektrisch',
    motor: 'Motor',
    afstandsbediening: 'Afstandsbediening',
    hydraulisch: 'Hydraulisch',
    automatisch: 'Automatisch',
    hand: 'Handbediend',
    onbekend: 'Onbekend',
  };
  return labels[b] || b;
}

export function bedieningColor(b: string): string {
  const colors: Record<string, string> = {
    zelfbediening: '#2563eb',
    drukknop: '#16a34a',
    handmatig: '#ea580c',
    elektrisch: '#eab308',
    motor: '#0891b2',
    afstandsbediening: '#7c3aed',
    hydraulisch: '#be185d',
    automatisch: '#059669',
    hand: '#ea580c',
    onbekend: '#6b7280',
  };
  return colors[b] || '#6b7280';
}

export function typeColor(t: string): string {
  const colors: Record<string, string> = {
    schutsluis: '#2563eb',
    sluis: '#2563eb',
    spuisluis: '#ea580c',
    sluisdeur: '#06b6d4',
    stuw: '#16a34a',
    gemaal: '#7c3aed',
    vispassage: '#ec4899',
  };
  return colors[t] || '#6b7280';
}

export function typeLabel(t: string): string {
  const labels: Record<string, string> = {
    schutsluis: 'Schutsluis',
    sluis: 'Sluis',
    spuisluis: 'Spuisluis',
    sluisdeur: 'Sluisdeur',
    stuw: 'Stuw',
    gemaal: 'Gemaal',
    vispassage: 'Vispassage',
  };
  return labels[t] || t;
}

export function categorieLabel(c: string): string {
  const labels: Record<string, string> = {
    sluis: 'Sluis',
    schutsluis: 'Schutsluis',
    spuisluis: 'Spuisluis',
    stuw: 'Stuw',
    gemaal: 'Gemaal',
    sluisdeur: 'Sluisdeur',
    vispassage: 'Vispassage',
  };
  return labels[c] || c;
}

export function bronLabel(b: string): string {
  const labels: Record<string, string> = {
    OSM: 'OpenStreetMap',
    BGT: 'BGT',
    Rijkswaterstaat: 'Rijkswaterstaat',
  };
  return labels[b] || b;
}

export function parseSeamarkTags(tagsJson: string | null | undefined): Record<string, string> | null {
  if (!tagsJson) return null;
  try {
    const tags = JSON.parse(tagsJson) as Record<string, string>;
    const seamark: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (key.startsWith('seamark:')) {
        const label = key.replace('seamark:', '').replace(/_/g, ' ');
        seamark[label] = value;
      }
    }
    return Object.keys(seamark).length > 0 ? seamark : null;
  } catch {
    return null;
  }
}

export function wikipediaUrl(ref: string): string {
  if (ref.startsWith('http')) return ref;
  const parts = ref.split(':');
  if (parts.length >= 2) {
    const lang = parts[0];
    const title = parts.slice(1).join(':');
    return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  }
  return `https://nl.wikipedia.org/wiki/${encodeURIComponent(ref)}`;
}

export function exportToCSV(sluizen: Sluis[], filename: string = 'sluizen.csv') {
  const headers = [
    'Naam', 'Provincie', 'Gemeente', 'Categorie', 'Type', 'Bron', 'Bediening', 'Lengte (m)',
    'Breedte (m)', 'Eigenaar', 'Bouwjaar', 'VHF', 'Lat', 'Lon',
  ];

  const rows = sluizen.map((s) => [
    s.naam, s.provincie, s.gemeente ?? '', s.categorie ?? '', s.type, s.bron ?? '',
    bedieningLabel(s.bediening), s.lengte ?? '', s.breedte ?? '',
    s.eigenaar ?? '', s.bouwjaar ?? '', s.vhf ?? '', s.lat, s.lon,
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
