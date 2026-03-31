export interface Sluis {
  id: string;
  naam: string;
  lat: number;
  lon: number;
  type: string;
  bediening: string;
  provincie: string;
  gemeente: string | null;
  lengte: number | null;
  breedte: number | null;
  diepte: number | null;
  maxhoogte: number | null;
  eigenaar: string | null;
  bouwjaar: number | null;
  vhf: string | null;
  openingstijden: string | null;
  website: string | null;
  wikipedia: string | null;
  bron?: string | null;
  categorie?: string | null;
  foto_url?: string | null;
  foto_bron?: string | null;
  beschrijving?: string | null;
  beheerder?: string | null;
  tags?: string | null;
}

export interface FilterState {
  zoek: string;
  provincie: string[];
  gemeente: string[];
  type: string[];
  categorie: string[];
  bron: string[];
  eigenaar: string[];
  lengteMin: number;
  lengteMax: number;
  breedteMin: number;
  breedteMax: number;
  bouwjaarMin: number;
  bouwjaarMax: number;
  heeftOpeningstijden: boolean;
  heeftVhf: boolean;
  heeftNaam: boolean;
  heeftAfmetingen: boolean;
  heeftBeheerder: boolean;
  sortering: 'naam' | 'provincie' | 'grootte';
}

// Default: no category filter — viewport-based loading handles performance
export const defaultFilters: FilterState = {
  zoek: '',
  provincie: [],
  gemeente: [],
  type: [],
  categorie: [],
  bron: [],
  eigenaar: [],
  lengteMin: 0,
  lengteMax: 500,
  breedteMin: 0,
  breedteMax: 100,
  bouwjaarMin: 1500,
  bouwjaarMax: 2030,
  heeftOpeningstijden: false,
  heeftVhf: false,
  heeftNaam: false,
  heeftAfmetingen: false,
  heeftBeheerder: false,
  sortering: 'naam',
};

// Overzicht page: no category pre-filter, show all
export const overzichtDefaultFilters: FilterState = {
  ...defaultFilters,
  categorie: [],
};

export interface Statistieken {
  totaal: number;
  provincies: ProvincieStats[];
  bedieningTypes: string[];
  types: [string, number][];
  categorieen: [string, number][];
  bronnen: [string, number][];
  uniqueProvincies: number;
  uniqueGemeenten: number;
  uniqueEigenaars: number;
  metNaam: number;
  metAfmetingen: number;
  metBeheerder: number;
  metFoto: number;
  provincieDetails: ProvincieDetailStats[];
}

export interface ProvincieDetailStats {
  provincie: string;
  totaal: number;
  metNaam: number;
  metAfmetingen: number;
}

export interface ProvincieStats {
  naam: string;
  totaal: number;
  [key: string]: string | number;
}

export interface FilterOptions {
  provincies: string[];
  gemeenten: string[];
  types: string[];
  categorieen: string[];
  bronnen: string[];
  eigenaars: string[];
}

export function sluisDisplayNaam(s: Sluis): string {
  if (s.naam && s.naam.trim()) return s.naam;
  const typeLabels: Record<string, string> = {
    sluisdeur: 'Sluisdeur',
    schutsluis: 'Schutsluis',
    spuisluis: 'Spuisluis',
    sluis: 'Sluis',
    stuw: 'Stuw',
    gemaal: 'Gemaal',
    dam: 'Dam',
    keersluis: 'Keersluis',
    vispassage: 'Vispassage',
    waterregulering: 'Waterregulering',
    waterwerk: 'Waterwerk',
  };
  const typeLabel = typeLabels[s.type] || 'Waterwerk';
  return `${typeLabel} (${s.provincie})`;
}
