"use client";

import { useState, useEffect } from "react";
import { Sluis, Statistieken } from "@/lib/types";
import { fetchSluizen, fetchStatistieken, exportToCSV, bedieningLabel } from "@/lib/utils";
import StatisticsTable from "@/components/StatisticsTable";
import {
  Loader2,
  Anchor,
  MapPin,
  Building2,
  Waves,
  Download,
} from "lucide-react";

export default function OverzichtPage() {
  const [sluizen, setSluizen] = useState<Sluis[]>([]);
  const [stats, setStats] = useState<Statistieken | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSluizen(), fetchStatistieken()]).then(([data, s]) => {
      setSluizen(data);
      setStats(s);
      setLoading(false);
    });
  }, []);

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

  const maxTypeCount = stats.types[0]?.[1] ?? 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            Overzicht Sluizen Nederland
          </h1>
          <p className="text-[var(--muted)]">
            Statistieken en overzicht van alle sluizen in Nederland
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Anchor className="w-6 h-6" />}
            label="Totaal sluizen"
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
        </div>

        {/* Province stats */}
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
                  {stats.bedieningTypes.map((bt) => (
                    <th
                      key={bt}
                      className="px-4 py-3 text-right font-semibold text-[var(--muted)] uppercase text-xs tracking-wide"
                    >
                      {bedieningLabel(bt)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ...stats.provincies.filter((p) => p.naam !== "Onbekend"),
                  ...stats.provincies.filter((p) => p.naam === "Onbekend"),
                ].map((p) => {
                  const isOnbekend = p.naam === "Onbekend";
                  return (
                    <tr key={p.naam} className={`hover:bg-slate-50 ${isOnbekend ? "bg-slate-50" : ""}`}>
                      <td className={`px-4 py-2.5 font-medium ${isOnbekend ? "text-[var(--muted)] italic" : "text-[var(--foreground)]"}`}>
                        {p.naam}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${isOnbekend ? "text-[var(--muted)]" : "text-[var(--primary)]"}`}>
                        {p.totaal}
                      </td>
                      {stats.bedieningTypes.map((bt) => (
                        <td
                          key={bt}
                          className="px-4 py-2.5 text-right text-[var(--muted)] tabular-nums"
                        >
                          {p[bt] || 0}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Type distribution */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Verdeling per type
          </h2>
          <div className="bg-white rounded-lg border border-[var(--border)] p-6 max-w-xl">
            <div className="space-y-3">
              {stats.types.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-[var(--foreground)] capitalize">
                      {type}
                    </span>
                    <span className="text-[var(--muted)] tabular-nums">
                      {count} ({((count / stats.totaal) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{
                        width: `${(count / maxTypeCount) * 100}%`,
                        backgroundColor: "var(--primary)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full table */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Alle sluizen
            </h2>
            <button
              onClick={() => exportToCSV(sluizen)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-light)] transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          <StatisticsTable sluizen={sluizen} />
        </section>
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
