"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sluis, sluisDisplayNaam } from "@/lib/types";
import { bedieningLabel, bedieningColor, typeColor, typeLabel, categorieLabel, bronLabel } from "@/lib/utils";
import { ArrowUpDown, ChevronLeft, ChevronRight, Camera } from "lucide-react";

type SortKey = "naam" | "provincie" | "gemeente" | "categorie" | "type" | "bron" | "bediening" | "lengte" | "breedte" | "eigenaar";
type SortDir = "asc" | "desc";

interface StatisticsTableProps {
  sluizen: Sluis[];
}

const PAGE_SIZE = 50;

export default function StatisticsTable({ sluizen }: StatisticsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("naam");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    return [...sluizen].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "naam":
          cmp = a.naam.localeCompare(b.naam, "nl");
          break;
        case "provincie":
          cmp = a.provincie.localeCompare(b.provincie, "nl");
          break;
        case "gemeente":
          cmp = (a.gemeente ?? "").localeCompare(b.gemeente ?? "", "nl");
          break;
        case "categorie":
          cmp = (a.categorie ?? "").localeCompare(b.categorie ?? "", "nl");
          break;
        case "type":
          cmp = a.type.localeCompare(b.type, "nl");
          break;
        case "bron":
          cmp = (a.bron ?? "").localeCompare(b.bron ?? "", "nl");
          break;
        case "bediening":
          cmp = a.bediening.localeCompare(b.bediening, "nl");
          break;
        case "lengte":
          cmp = (a.lengte ?? 0) - (b.lengte ?? 0);
          break;
        case "breedte":
          cmp = (a.breedte ?? 0) - (b.breedte ?? 0);
          break;
        case "eigenaar":
          cmp = (a.eigenaar ?? "").localeCompare(b.eigenaar ?? "", "nl");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sluizen, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function SortHeader({ label, colKey }: { label: string; colKey: SortKey }) {
    const active = sortKey === colKey;
    return (
      <th
        className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide cursor-pointer hover:text-[var(--foreground)] select-none whitespace-nowrap"
        onClick={() => toggleSort(colKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown
            className={`w-3 h-3 ${active ? "text-[var(--primary)]" : "text-[var(--border)]"}`}
          />
        </span>
      </th>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-[var(--border)]">
            <tr>
              <SortHeader label="Naam" colKey="naam" />
              <SortHeader label="Provincie" colKey="provincie" />
              <SortHeader label="Gemeente" colKey="gemeente" />
              <SortHeader label="Categorie" colKey="categorie" />
              <SortHeader label="Type" colKey="type" />
              <SortHeader label="Bron" colKey="bron" />
              <SortHeader label="Bediening" colKey="bediening" />
              <SortHeader label="Lengte (m)" colKey="lengte" />
              <SortHeader label="Breedte (m)" colKey="breedte" />
              <SortHeader label="Eigenaar" colKey="eigenaar" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                Foto
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {pageData.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2">
                  <Link
                    href={`/sluis/${s.id.split('/').map(encodeURIComponent).join('/')}`}
                    className="text-[var(--primary)] font-medium hover:underline"
                  >
                    {sluisDisplayNaam(s)}
                  </Link>
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">{s.provincie}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{s.gemeente ?? "-"}</td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {s.categorie ? categorieLabel(s.categorie) : "-"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="text-white px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: typeColor(s.type) }}
                  >
                    {typeLabel(s.type)}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--muted)] text-xs">
                  {s.bron ? bronLabel(s.bron) : "-"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="text-white px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: bedieningColor(s.bediening) }}
                  >
                    {bedieningLabel(s.bediening)}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--muted)] tabular-nums">
                  {s.lengte ?? "-"}
                </td>
                <td className="px-3 py-2 text-[var(--muted)] tabular-nums">
                  {s.breedte ?? "-"}
                </td>
                <td className="px-3 py-2 text-[var(--muted)] truncate max-w-[200px]">
                  {s.eigenaar ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {s.foto_url ? (
                    <a
                      href={s.foto_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] hover:text-[var(--accent-light)]"
                      title="Bekijk foto"
                    >
                      <Camera className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-[var(--border)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[var(--muted)]">
            {(page * PAGE_SIZE + 1).toLocaleString("nl-NL")} - {Math.min((page + 1) * PAGE_SIZE, sorted.length).toLocaleString("nl-NL")} van{" "}
            {sorted.length.toLocaleString("nl-NL")}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-[var(--border)] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-[var(--muted)]">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border border-[var(--border)] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
