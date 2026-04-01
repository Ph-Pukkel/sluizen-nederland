"use client";

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sluis, Statistieken, FilterState, FilterOptions, overzichtDefaultFilters, sluisDisplayNaam } from "@/lib/types";
import {
  fetchSluizen,
  fetchStatistieken,
  fetchFilterOptions,
  exportToCSV,
  typeColor,
  typeLabel,
  categorieLabel,
  bronLabel,
  bedieningLabel,
  bedieningColor,
  filtersToSearchParams,
  searchParamsToFilters,
  wikipediaUrl,
} from "@/lib/utils";
import Link from "next/link";
import StatisticsTable from "@/components/StatisticsTable";
import {
  Loader2,
  Anchor,
  MapPin,
  Building2,
  Waves,
  Download,
  Search,
  X,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Camera,
  ChevronRight,
  Tag,
  ExternalLink,
  ZoomIn,
} from "lucide-react";

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  labelFn,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  labelFn?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-slate-50 transition-colors w-full"
      >
        <span className="truncate text-left flex-1">
          {count > 0 ? `${label} (${count})` : label}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-[var(--border)] rounded-lg shadow-lg p-2">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => {
                  if (selected.includes(opt)) {
                    onChange(selected.filter((v) => v !== opt));
                  } else {
                    onChange([...selected, opt]);
                  }
                }}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              <span className="truncate">{labelFn ? labelFn(opt) : opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverzichtPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
      </div>
    }>
      <OverzichtContent />
    </Suspense>
  );
}

function OverzichtContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilters = useMemo(() => {
    if (searchParams.toString()) {
      return searchParamsToFilters(searchParams);
    }
    return overzichtDefaultFilters;
  }, []);

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sluizen, setSluizen] = useState<Sluis[]>([]);
  const [stats, setStats] = useState<Statistieken | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    provincies: [],
    gemeenten: [],
    waterschappen: [],
    categorieen: [],
    bronnen: [],
    eigenaars: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedFoto, setSelectedFoto] = useState<Sluis | null>(null);
  const [showAllFotos, setShowAllFotos] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load filter options on mount
  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions);
  }, []);

  // Fetch data when filters change (debounced)
  const loadData = useCallback((f: FilterState) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRefreshing(true);
      Promise.all([fetchSluizen(f, 100000), fetchStatistieken(f)]).then(([res, s]) => {
        setSluizen(res.data);
        setStats(s);
        setLoading(false);
        setRefreshing(false);
      });
    }, 300);
  }, []);

  useEffect(() => {
    loadData(filters);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, loadData]);

  // Sync filters to URL
  useEffect(() => {
    const params = filtersToSearchParams(filters);
    const query = params.toString();
    const newUrl = query ? `/overzicht?${query}` : "/overzicht";
    router.replace(newUrl, { scroll: false });
  }, [filters, router]);

  // Update gemeenten when provincie changes
  useEffect(() => {
    fetchFilterOptions(
      filters.provincie.length > 0 ? filters.provincie : undefined
    ).then((opts) => {
      setFilterOptions((prev) => ({ ...prev, gemeenten: opts.gemeenten }));
    });
  }, [filters.provincie]);

  const sluizenMetFoto = useMemo(() => sluizen.filter(s => s.foto_url), [sluizen]);

  const update = (partial: Partial<FilterState>) => {
    setShowAllFotos(false);
    setFilters((prev) => ({ ...prev, ...partial }));
  };

  const resetFilters = () => {
    setFilters(overzichtDefaultFilters);
  };

  const activeFilterCount = [
    filters.zoek,
    filters.provincie.length > 0,
    filters.gemeente.length > 0,
    filters.waterschap.length > 0,
    filters.categorie.length > 0,
    filters.bron.length > 0,
    filters.eigenaar.length > 0,
    filters.heeftNaam,
    filters.heeftAfmetingen,
    filters.heeftBeheerder,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--muted)]">Geen data beschikbaar. Ververs de pagina.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            Overzicht Waterstructuren Nederland
          </h1>
          <p className="text-[var(--muted)]">
            Filter en verken alle waterstructuren in Nederland
          </p>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="font-semibold text-sm text-[var(--foreground)]">Filters</h2>
              {activeFilterCount > 0 && (
                <span className="bg-[var(--accent)] text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {refreshing && (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
              )}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-[var(--muted)] hover:text-[var(--accent)] flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Zoek op naam, provincie, beheerder..."
              value={filters.zoek}
              onChange={(e) => update({ zoek: e.target.value })}
              className="w-full pl-9 pr-9 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            />
            {filters.zoek && (
              <button
                onClick={() => update({ zoek: "" })}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-[var(--muted)]" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
            <MultiSelect
              label="Provincie"
              options={[
                ...filterOptions.provincies.filter((p) => p !== "Onbekend"),
                ...filterOptions.provincies.filter((p) => p === "Onbekend"),
              ]}
              selected={filters.provincie}
              onChange={(v) => update({ provincie: v, gemeente: [] })}
            />
            {filterOptions.gemeenten.length > 0 && (
              <MultiSelect
                label="Gemeente"
                options={[
                  ...filterOptions.gemeenten.filter((g) => g !== "Onbekend"),
                  ...filterOptions.gemeenten.filter((g) => g === "Onbekend"),
                ]}
                selected={filters.gemeente}
                onChange={(v) => update({ gemeente: v })}
              />
            )}
            <MultiSelect
              label="Categorie"
              options={filterOptions.categorieen}
              selected={filters.categorie}
              onChange={(v) => update({ categorie: v })}
              labelFn={categorieLabel}
            />
            <MultiSelect
              label="Bron"
              options={filterOptions.bronnen}
              selected={filters.bron}
              onChange={(v) => update({ bron: v })}
              labelFn={bronLabel}
            />
          </div>

          {/* Toggle filters */}
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={filters.heeftNaam}
                onChange={() => update({ heeftNaam: !filters.heeftNaam })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft naam
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={filters.heeftAfmetingen}
                onChange={() => update({ heeftAfmetingen: !filters.heeftAfmetingen })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft afmetingen
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={filters.heeftBeheerder}
                onChange={() => update({ heeftBeheerder: !filters.heeftBeheerder })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft beheerder
            </label>
          </div>
        </div>

        {/* Foto galerij */}
        {sluizenMetFoto.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Foto&apos;s
                <span className="text-sm font-normal text-[var(--muted)] ml-2">
                  ({sluizenMetFoto.length}{filters.categorie.length > 0 ? ` in geselecteerde categorie${filters.categorie.length > 1 ? "ën" : ""}` : ""})
                </span>
              </h2>
              {sluizenMetFoto.length > 12 && (
                <button
                  onClick={() => setShowAllFotos(!showAllFotos)}
                  className="text-sm text-[var(--primary)] hover:underline font-medium"
                >
                  {showAllFotos ? "Minder tonen" : `Alle ${sluizenMetFoto.length} tonen`}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(showAllFotos ? sluizenMetFoto : sluizenMetFoto.slice(0, 12)).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedFoto(s)}
                  className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-slate-100 aspect-square hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <img
                    src={s.foto_url!}
                    alt={sluisDisplayNaam(s)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
                      <p className="text-white text-xs font-semibold leading-tight truncate">{sluisDisplayNaam(s)}</p>
                      <p className="text-white/70 text-xs truncate">{s.provincie}</p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-black/50 rounded-full p-1 block">
                      <ZoomIn className="w-3 h-3 text-white" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {!showAllFotos && sluizenMetFoto.length > 12 && (
              <button
                onClick={() => setShowAllFotos(true)}
                className="mt-3 w-full py-2.5 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
              >
                + {sluizenMetFoto.length - 12} meer foto&apos;s tonen
              </button>
            )}
          </section>
        )}

        {/* Foto modal */}
        {selectedFoto && (
          <FotoModal sluis={selectedFoto} onClose={() => setSelectedFoto(null)} />
        )}

        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            icon={<Anchor className="w-6 h-6" />}
            label="Gevonden"
            value={stats.totaal}
            color="var(--primary)"
          />
          <StatCard
            icon={<MapPin className="w-6 h-6" />}
            label="Provincies"
            value={stats.uniqueProvincies}
            color="#16a34a"
          />
          <StatCard
            icon={<Waves className="w-6 h-6" />}
            label="Gemeenten"
            value={stats.uniqueGemeenten}
            color="var(--accent)"
          />
          <StatCard
            icon={<Building2 className="w-6 h-6" />}
            label="Beheerders"
            value={stats.uniqueEigenaars}
            color="#7c3aed"
          />
          <StatCard
            icon={<Tag className="w-6 h-6" />}
            label="Met naam"
            value={stats.metNaam}
            color="#0891b2"
          />
          <StatCard
            icon={<Camera className="w-6 h-6" />}
            label="Met foto"
            value={stats.metFoto}
            color="#d97706"
          />
        </div>

        {/* Province stats */}
        {stats.provincieDetails && stats.provincieDetails.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
              Per provincie
            </h2>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--muted)] uppercase text-xs tracking-wide">
                      Provincie
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--muted)] uppercase text-xs tracking-wide">
                      Totaal
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--muted)] uppercase text-xs tracking-wide">
                      Met naam
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--muted)] uppercase text-xs tracking-wide">
                      Met afmetingen
                    </th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[
                    ...stats.provincieDetails.filter((p) => p.provincie !== "Onbekend"),
                    ...stats.provincieDetails.filter((p) => p.provincie === "Onbekend"),
                  ].map((p) => {
                    const isOnbekend = p.provincie === "Onbekend";
                    return (
                      <tr
                        key={p.provincie}
                        className={`hover:bg-slate-100 cursor-pointer transition-colors ${isOnbekend ? "bg-slate-50" : ""}`}
                        onClick={() => update({ provincie: [p.provincie], gemeente: [] })}
                      >
                        <td className={`px-4 py-2.5 font-medium ${isOnbekend ? "text-[var(--muted)] italic" : "text-[var(--foreground)]"}`}>
                          {p.provincie}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${isOnbekend ? "text-[var(--muted)]" : "text-[var(--primary)]"}`}>
                          {p.totaal.toLocaleString("nl-NL")}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[var(--muted)] tabular-nums">
                          {p.metNaam.toLocaleString("nl-NL")}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[var(--muted)] tabular-nums">
                          {p.metAfmetingen.toLocaleString("nl-NL")}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--muted)]">
                          <ChevronRight className="w-4 h-4" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Categorie distribution */}
          {stats.categorieen && stats.categorieen.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
                Verdeling per categorie
              </h2>
              <div className="bg-white rounded-lg border border-[var(--border)] p-6">
                <div className="space-y-3">
                  {stats.categorieen.map(([cat, count]) => (
                    <div
                      key={cat}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => update({ categorie: [cat] })}
                    >
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-[var(--foreground)]">
                          {categorieLabel(cat)}
                        </span>
                        <span className="text-[var(--muted)] tabular-nums">
                          {count.toLocaleString("nl-NL")} ({((count / stats.totaal) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${(count / (stats.categorieen[0]?.[1] ?? 1)) * 100}%`,
                            backgroundColor: typeColor(cat),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

        </div>

        {/* Bron distribution */}
        {stats.bronnen && stats.bronnen.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
              Verdeling per bron
            </h2>
            <div className="bg-white rounded-lg border border-[var(--border)] p-6 max-w-xl">
              <div className="space-y-3">
                {stats.bronnen.map(([bron, count]) => (
                  <div key={bron}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-[var(--foreground)]">
                        {bronLabel(bron)}
                      </span>
                      <span className="text-[var(--muted)] tabular-nums">
                        {count.toLocaleString("nl-NL")} ({((count / stats.totaal) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{
                          width: `${(count / (stats.bronnen[0]?.[1] ?? 1)) * 100}%`,
                          backgroundColor: "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Full table */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Resultaten
              <span className="text-sm font-normal text-[var(--muted)] ml-2">
                ({sluizen.length.toLocaleString("nl-NL")})
              </span>
            </h2>
            <button
              onClick={async () => {
                setExporting(true);
                const res = await fetchSluizen(filters, 100000);
                exportToCSV(res.data);
                setExporting(false);
              }}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors disabled:opacity-60"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Laden..." : `Export CSV (${stats.totaal.toLocaleString("nl-NL")})`}
            </button>
          </div>
          <StatisticsTable sluizen={sluizen} />
        </section>
      </div>
    </div>
  );
}

function FotoModal({ sluis, onClose }: { sluis: Sluis; onClose: () => void }) {
  const encodedId = sluis.id.split('/').map(encodeURIComponent).join('/');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Foto */}
        <div className="relative">
          <img
            src={sluis.foto_url!}
            alt={sluisDisplayNaam(sluis)}
            className="w-full h-56 sm:h-72 object-cover rounded-t-2xl"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/75 text-white rounded-full p-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3">
            <span
              className="text-white text-xs px-2.5 py-1 rounded-full font-medium shadow"
              style={{ backgroundColor: typeColor(sluis.type) }}
            >
              {typeLabel(sluis.type)}
            </span>
          </div>
        </div>

        {/* Inhoud */}
        <div className="p-5">
          {/* Naam + locatie */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[var(--foreground)] leading-tight">
              {sluisDisplayNaam(sluis)}
            </h2>
            <p className="text-sm text-[var(--muted)] mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {sluis.gemeente ? `${sluis.gemeente}, ` : ''}{sluis.provincie}
            </p>
          </div>

          {/* Details */}
          {(sluis.lengte || sluis.breedte || sluis.diepte || sluis.eigenaar || sluis.bouwjaar || sluis.vhf || sluis.openingstijden) && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm bg-slate-50 rounded-lg p-4 mb-4">
              {sluis.lengte != null && (
                <><span className="text-[var(--muted)]">Lengte</span><span className="font-medium">{sluis.lengte} m</span></>
              )}
              {sluis.breedte != null && (
                <><span className="text-[var(--muted)]">Breedte</span><span className="font-medium">{sluis.breedte} m</span></>
              )}
              {sluis.diepte != null && (
                <><span className="text-[var(--muted)]">Diepte</span><span className="font-medium">{sluis.diepte} m</span></>
              )}
              {sluis.eigenaar && (
                <><span className="text-[var(--muted)]">Beheerder</span><span className="font-medium truncate">{sluis.eigenaar}</span></>
              )}
              {sluis.bouwjaar && (
                <><span className="text-[var(--muted)]">Bouwjaar</span><span className="font-medium">{sluis.bouwjaar}</span></>
              )}
              {sluis.vhf && (
                <><span className="text-[var(--muted)]">VHF</span><span className="font-medium">{sluis.vhf}</span></>
              )}
              {sluis.openingstijden && (
                <><span className="text-[var(--muted)]">Openingstijden</span><span className="font-medium text-xs">{sluis.openingstijden}</span></>
              )}
            </div>
          )}

          {/* Externe links */}
          <div className="flex flex-wrap gap-2 mb-4">
            <a href={`https://www.google.com/maps?q=&layer=c&cbll=${sluis.lat},${sluis.lon}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-[var(--foreground)] transition-colors">
              <ExternalLink className="w-3 h-3" /> Street View
            </a>
            <a href={`https://earth.google.com/web/search/${sluis.lat},${sluis.lon}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-[var(--foreground)] transition-colors">
              <ExternalLink className="w-3 h-3" /> Google Earth
            </a>
            <a href={`https://www.google.com/maps/@${sluis.lat},${sluis.lon},100m/data=!3m1!1e3`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-[var(--foreground)] transition-colors">
              <ExternalLink className="w-3 h-3" /> Satelliet
            </a>
            {sluis.wikipedia && (
              <a href={wikipediaUrl(sluis.wikipedia)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-medium text-blue-700 transition-colors">
                <ExternalLink className="w-3 h-3" /> Wikipedia
              </a>
            )}
            {sluis.website && (
              <a href={sluis.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-medium text-blue-700 transition-colors">
                <ExternalLink className="w-3 h-3" /> Website
              </a>
            )}
          </div>

          {/* Naar detailpagina */}
          <Link
            href={`/sluis/${encodedId}`}
            className="block w-full text-center py-2.5 bg-[var(--primary)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Volledige detailpagina →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--foreground)] tabular-nums">
            {value.toLocaleString("nl-NL")}
          </p>
          <p className="text-sm text-[var(--muted)]">{label}</p>
        </div>
      </div>
    </div>
  );
}
