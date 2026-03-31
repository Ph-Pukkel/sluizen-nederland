"use client";

import { useState } from "react";
import { FilterState, FilterOptions, defaultFilters } from "@/lib/types";
import { bedieningLabel, typeLabel } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

interface FilterPanelProps {
  filters: FilterState;
  filterOptions: FilterOptions;
  onChange: (filters: FilterState) => void;
  resultCount: number;
}

function FilterSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-slate-50 transition-colors"
      >
        {title}
        {open ? (
          <ChevronUp className="w-4 h-4 text-[var(--muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--muted)]" />
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
  labelFn,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  labelFn?: (v: string) => string;
}) {
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded"
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
            className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          <span className="truncate">{labelFn ? labelFn(opt) : opt}</span>
        </label>
      ))}
    </div>
  );
}

function RangeSlider({
  label,
  min,
  max,
  valueMin,
  valueMax,
  onChangeMin,
  onChangeMax,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span>
          {valueMin} - {valueMax}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => onChangeMin(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[var(--primary)]"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => onChangeMax(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[var(--accent)]"
        />
      </div>
    </div>
  );
}

export default function FilterPanel({
  filters,
  filterOptions,
  onChange,
  resultCount,
}: FilterPanelProps) {
  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  const activeFilterCount = [
    filters.zoek,
    filters.provincie.length > 0,
    filters.gemeente.length > 0,
    filters.type.length > 0,
    filters.bediening.length > 0,
    filters.eigenaar.length > 0,
    filters.lengteMin > 0 || filters.lengteMax < 500,
    filters.breedteMin > 0 || filters.breedteMax < 100,
    filters.bouwjaarMin > 1500 || filters.bouwjaarMax < 2030,
    filters.heeftOpeningstijden,
    filters.heeftVhf,
    filters.heeftNaam,
    filters.heeftAfmetingen,
    filters.heeftBeheerder,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-white border-r border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="font-semibold text-sm text-[var(--foreground)]">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="bg-[var(--accent)] text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => onChange(defaultFilters)}
              className="text-xs text-[var(--muted)] hover:text-[var(--accent)] flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Zoek op naam, provincie..."
            value={filters.zoek}
            onChange={(e) => update({ zoek: e.target.value })}
            className="w-full pl-8 pr-8 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
          />
          {filters.zoek && (
            <button
              onClick={() => update({ zoek: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-[var(--muted)]" />
            </button>
          )}
        </div>

        <p className="text-xs text-[var(--muted)] mt-2">
          {resultCount} sluizen gevonden
        </p>
      </div>

      {/* Filter sections */}
      <div className="flex-1 overflow-y-auto filter-sidebar">
        <FilterSection title="Provincie" defaultOpen>
          <CheckboxGroup
            options={[
              ...filterOptions.provincies.filter((p) => p !== "Onbekend"),
              ...filterOptions.provincies.filter((p) => p === "Onbekend"),
            ]}
            selected={filters.provincie}
            onChange={(v) => update({ provincie: v, gemeente: [] })}
          />
        </FilterSection>

        {filterOptions.gemeenten.length > 0 && (
          <FilterSection title="Gemeente">
            <CheckboxGroup
              options={filterOptions.gemeenten}
              selected={filters.gemeente}
              onChange={(v) => update({ gemeente: v })}
            />
          </FilterSection>
        )}

        <FilterSection title="Snel filteren" defaultOpen>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={filters.heeftNaam}
                onChange={() => update({ heeftNaam: !filters.heeftNaam })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft naam
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={filters.heeftAfmetingen}
                onChange={() => update({ heeftAfmetingen: !filters.heeftAfmetingen })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft afmetingen
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={filters.heeftBeheerder}
                onChange={() => update({ heeftBeheerder: !filters.heeftBeheerder })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft beheerder
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={filters.heeftOpeningstijden}
                onChange={() =>
                  update({ heeftOpeningstijden: !filters.heeftOpeningstijden })
                }
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft openingstijden
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={filters.heeftVhf}
                onChange={() => update({ heeftVhf: !filters.heeftVhf })}
                className="rounded border-[var(--border)] text-[var(--primary)]"
              />
              Heeft VHF kanaal
            </label>
          </div>
        </FilterSection>

        <FilterSection title="Type sluis" defaultOpen>
          <CheckboxGroup
            options={filterOptions.types}
            selected={filters.type}
            onChange={(v) => update({ type: v })}
            labelFn={typeLabel}
          />
        </FilterSection>

        <FilterSection title="Bediening" defaultOpen>
          <CheckboxGroup
            options={filterOptions.bedieningen}
            selected={filters.bediening}
            onChange={(v) => update({ bediening: v })}
            labelFn={bedieningLabel}
          />
        </FilterSection>

        {filterOptions.eigenaars.length > 0 && (
          <FilterSection title="Eigenaar/beheerder">
            <CheckboxGroup
              options={filterOptions.eigenaars}
              selected={filters.eigenaar}
              onChange={(v) => update({ eigenaar: v })}
            />
          </FilterSection>
        )}

        <FilterSection title="Afmetingen">
          <div className="space-y-3">
            <RangeSlider
              label="Lengte"
              min={0}
              max={500}
              valueMin={filters.lengteMin}
              valueMax={filters.lengteMax}
              onChangeMin={(v) => update({ lengteMin: v })}
              onChangeMax={(v) => update({ lengteMax: v })}
              unit="m"
            />
            <RangeSlider
              label="Breedte"
              min={0}
              max={100}
              valueMin={filters.breedteMin}
              valueMax={filters.breedteMax}
              onChangeMin={(v) => update({ breedteMin: v })}
              onChangeMax={(v) => update({ breedteMax: v })}
              unit="m"
            />
          </div>
        </FilterSection>

        <FilterSection title="Bouwperiode">
          <RangeSlider
            label="Bouwjaar"
            min={1500}
            max={2030}
            valueMin={filters.bouwjaarMin}
            valueMax={filters.bouwjaarMax}
            onChangeMin={(v) => update({ bouwjaarMin: v })}
            onChangeMax={(v) => update({ bouwjaarMax: v })}
          />
        </FilterSection>

        <FilterSection title="Sortering">
          <select
            value={filters.sortering}
            onChange={(e) =>
              update({ sortering: e.target.value as FilterState["sortering"] })
            }
            className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
          >
            <option value="naam">Naam (A-Z)</option>
            <option value="provincie">Provincie</option>
            <option value="grootte">Grootte (groot-klein)</option>
          </select>
        </FilterSection>
      </div>
    </div>
  );
}
