"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sluis, sluisDisplayNaam } from "@/lib/types";
import { bedieningLabel, bedieningColor, typeColor, typeLabel, categorieLabel, bronLabel } from "@/lib/utils";
import { ArrowUpDown, ChevronLeft, ChevronRight, Camera } from "lucide-react";

type SortKey = "naam" | "provincie" | "gemeente" | "categorie" | "type" | "bron" | "lengte" | "breedte" | "eigenaar" | "foto";
type SortDir = "asc" | "desc";

interface StatisticsTableProps {
  sluizen: Sluis[];
}

const PAGE_SIZE = 50;

export default function StatisticsTable({ sluizen }: StatisticsTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("foto");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
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
        case "lengte":
          cmp = (a.lengte ?? 0) - (b.lengte ?? 0);
          break;
        case "breedte":
          cmp = (a.breedte ?? 0) - (b.breedte ?? 0);
          break;
        case "eigenaar":
          cmp = (a.eigenaar ?? "").localeCompare(b.eigenaar ?? "", "nl");
          break;
        case "foto":
          cmp = (a.foto_url ? 1 : 0) - (b.foto_url ? 1 : 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sluizen, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const metFotoCount = useMemo(() => sluizen.filter((s) => s.foto_url).length, [sluizen]);

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
              <SortHeader label="Foto" colKey="foto" />
              <SortHeader label="Naam" colKey="naam" />
              <SortHeader label="Provincie" colKey="provincie" />
              <SortHeader label="Gemeente" colKey="gemeente" />
              <SortHeader label="Categorie" colKey="categorie" />
              <SortHeader label="Type" colKey="type" />
              <SortHeader label="Bron" colKey="bron" />
              <SortHeader label="Lengte (m)" colKey="lengte" />
              <SortHeader label="Breedte (m)" colKey="breedte" />
              <SortHeader label="Eigenaar" colKey="eigenaar" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {pageData.map((s) => (
              <tr
                key={s.id}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/sluis/${s.id.split('/').map(encodeURIComponent).join('/')}`)}
              >
                <td className="px-3 py-2">
                  {s.foto_url ? (
                    <img
                      src={s.foto_url}
                      alt=""
                      className="w-8 h-8 object-cover rounded"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[var(--border)]">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="text-[var(--primary)] font-medium">
                    {sluisDisplayNaam(s)}
                  </span>
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
                <td className="px-3 py-2 text-[var(--muted)] tabular-nums">
                  {s.lengte ?? "-"}
                </td>
                <td className="px-3 py-2 text-[var(--muted)] tabular-nums">
                  {s.breedte ?? "-"}
                </td>
                <td className="px-3 py-2 text-[var(--muted)] truncate max-w-[200px]">
                  {s.eigenaar ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-[var(--muted)]">
          {totalPages > 1 && (
            <span>
              {(page * PAGE_SIZE + 1).toLocaleString("nl-NL")} - {Math.min((page + 1) * PAGE_SIZE, sorted.length).toLocaleString("nl-NL")} van{" "}
              {sorted.length.toLocaleString("nl-NL")}
              {" | "}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Camera className="w-3.5 h-3.5" />
            {metFotoCount.toLocaleString("nl-NL")} van {sluizen.length.toLocaleString("nl-NL")} records hebben een foto
          </span>
        </div>
        {totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
}
