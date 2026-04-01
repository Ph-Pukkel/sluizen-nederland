"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Sluis, FilterState, defaultFilters } from "@/lib/types";
import { fetchSluizen, fetchFilterOptions, filtersToSearchParams, searchParamsToFilters } from "@/lib/utils";
import type { MapBounds } from "@/lib/utils";
import type { FilterOptions } from "@/lib/types";
import FilterPanel from "@/components/FilterPanel";
import SluisCard from "@/components/SluisCard";
import { Loader2, X, PanelLeftClose, PanelLeftOpen, TableProperties } from "lucide-react";

const MapComponent = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-100">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
    </div>
  ),
});

export default function KaartPage() {
  const router = useRouter();
  const [sluizen, setSluizen] = useState<Sluis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const initializedFromUrl = useRef(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    provincies: [],
    gemeenten: [],
    waterschappen: [],
    categorieen: [],
    bronnen: [],
    eigenaars: [],
  });
  const [selectedSluis, setSelectedSluis] = useState<Sluis | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const totalCountRef = useRef(0);
  const pendingCountRef = useRef(0);

  // Initialize filters from URL params on first mount
  useEffect(() => {
    if (!initializedFromUrl.current) {
      initializedFromUrl.current = true;
      const params = new URLSearchParams(window.location.search);
      if (params.toString()) {
        setFilters(searchParamsToFilters(params));
      }
    }
  }, []);

  // Load filter options on mount
  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions);
  }, []);

  // Sync filters to URL whenever they change
  useEffect(() => {
    const params = filtersToSearchParams(filters);
    const query = params.toString();
    const newUrl = query ? `/kaart?${query}` : "/kaart";
    router.replace(newUrl, { scroll: false });
  }, [filters, router]);

  // Load sluizen when filters or bounds change (debounced)
  useEffect(() => {
    if (!bounds) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Reset pending count to prevent stale display during loading
    pendingCountRef.current = 0;

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetchSluizen(filters, 100000, 0, bounds).then((res) => {
        setSluizen(res.data);
        totalCountRef.current = res.total_count;
        pendingCountRef.current = res.total_count;
        setLoading(false);
      });
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, bounds]);

  // Update gemeenten when provincie changes
  useEffect(() => {
    fetchFilterOptions(
      filters.provincie.length > 0 ? filters.provincie : undefined
    ).then((opts) => {
      setFilterOptions((prev) => ({ ...prev, gemeenten: opts.gemeenten }));
    });
  }, [filters.provincie]);

  const handleSluisSelect = useCallback((sluis: Sluis) => {
    setSelectedSluis(sluis);
  }, []);

  const handleBoundsChange = useCallback((newBounds: MapBounds) => {
    setBounds(newBounds);
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Filter sidebar */}
      {sidebarOpen && (
        <div className="w-80 shrink-0 overflow-hidden flex flex-col border-r border-[var(--border)] max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:shadow-xl">
          <FilterPanel
            filters={filters}
            filterOptions={filterOptions}
            onChange={setFilters}
            resultCount={sluizen.length}
          />
        </div>
      )}

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-3 z-10 bg-white shadow-md rounded-r-lg p-2 border border-l-0 border-[var(--border)] hover:bg-slate-50 transition-colors"
        style={{ left: sidebarOpen ? "320px" : "0" }}
        title={sidebarOpen ? "Verberg filters" : "Toon filters"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="w-4 h-4 text-[var(--muted)]" />
        ) : (
          <PanelLeftOpen className="w-4 h-4 text-[var(--muted)]" />
        )}
      </button>

      {/* Map area */}
      <div className="flex-1 relative">
        <MapComponent
          sluizen={sluizen}
          onSluisSelect={handleSluisSelect}
          onBoundsChange={handleBoundsChange}
        />

        {/* Result count overlay */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 text-sm flex items-center gap-2">
          <div>
            <span className="font-semibold text-[var(--primary)]">{sluizen.length.toLocaleString("nl-NL")}</span>
            <span className="text-[var(--muted)]"> waterstructuren in beeld</span>
            {!loading && totalCountRef.current > sluizen.length && (
              <span className="text-[var(--muted)]"> (van {totalCountRef.current.toLocaleString("nl-NL")})</span>
            )}
            {loading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)] inline-block ml-2" />
            )}
          </div>
          <a
            href={`/overzicht?${filtersToSearchParams(filters).toString()}`}
            className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline border-l border-[var(--border)] pl-2 ml-1"
            title="Bekijk als tabel in overzicht"
          >
            <TableProperties className="w-3.5 h-3.5" />
            Overzicht
          </a>
        </div>
      </div>

      {/* Selected sluis detail panel */}
      {selectedSluis && (
        <div className="w-96 shrink-0 overflow-y-auto border-l border-[var(--border)] bg-white max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-xl">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--foreground)]">Details</h3>
              <button
                onClick={() => setSelectedSluis(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4 text-[var(--muted)]" />
              </button>
            </div>
            <SluisCard sluis={selectedSluis} />
          </div>
        </div>
      )}
    </div>
  );
}
