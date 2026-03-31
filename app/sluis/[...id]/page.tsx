"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Sluis, sluisDisplayNaam } from "@/lib/types";
import { fetchSluis, bedieningLabel, bedieningColor, typeColor, typeLabel, wikipediaUrl, parseSeamarkTags } from "@/lib/utils";
import {
  ArrowLeft,
  MapPin,
  Ruler,
  Radio,
  Clock,
  Building2,
  Calendar,
  ExternalLink,
  Loader2,
  Waves,
  ArrowUpFromLine,
  Info,
} from "lucide-react";

const MiniMap = dynamic(
  () =>
    import("@/components/Map").then((mod) => {
      const MiniMapWrapper = ({ sluis }: { sluis: Sluis }) => (
        <mod.default sluizen={[sluis]} />
      );
      MiniMapWrapper.displayName = "MiniMapWrapper";
      return MiniMapWrapper;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    ),
  }
);

export default function SluisDetailPage() {
  const params = useParams();
  const idSegments = params.id as string[];
  const fullId = idSegments.map(decodeURIComponent).join("/");
  const [sluis, setSluis] = useState<Sluis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSluis(fullId).then((data) => {
      setSluis(data);
      setLoading(false);
    });
  }, [fullId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!sluis) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Sluis niet gevonden</h2>
          <p className="text-[var(--muted)] mb-4">
            De sluis met ID &quot;{fullId}&quot; kon niet worden gevonden.
          </p>
          <Link
            href="/kaart"
            className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-light)] font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug naar kaart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/kaart"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar kaart
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
              {sluisDisplayNaam(sluis)}
            </h1>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <MapPin className="w-4 h-4" />
              <span>
                {sluis.gemeente ? `${sluis.gemeente}, ` : ""}
                {sluis.provincie}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <span
              className="text-white px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: typeColor(sluis.type) }}
            >
              {typeLabel(sluis.type)}
            </span>
            <span
              className="text-white px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: bedieningColor(sluis.bediening) }}
            >
              {bedieningLabel(sluis.bediening)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Specifications */}
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm">
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)]">Specificaties</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sluis.lengte != null && (
                    <DetailItem
                      icon={<Ruler className="w-4 h-4" />}
                      label="Lengte"
                      value={`${sluis.lengte} meter`}
                    />
                  )}
                  {sluis.breedte != null && (
                    <DetailItem
                      icon={<Ruler className="w-4 h-4" />}
                      label="Breedte"
                      value={`${sluis.breedte} meter`}
                    />
                  )}
                  {sluis.diepte != null && (
                    <DetailItem
                      icon={<Waves className="w-4 h-4" />}
                      label="Diepte"
                      value={`${sluis.diepte} meter`}
                    />
                  )}
                  {sluis.maxhoogte != null && (
                    <DetailItem
                      icon={<ArrowUpFromLine className="w-4 h-4" />}
                      label="Max. doorvaarthoogte"
                      value={`${sluis.maxhoogte} meter`}
                    />
                  )}
                  {sluis.eigenaar && (
                    <DetailItem
                      icon={<Building2 className="w-4 h-4" />}
                      label="Beheerder"
                      value={sluis.eigenaar}
                    />
                  )}
                  {sluis.bouwjaar && (
                    <DetailItem
                      icon={<Calendar className="w-4 h-4" />}
                      label="Bouwjaar"
                      value={String(sluis.bouwjaar)}
                    />
                  )}
                  {sluis.vhf && (
                    <DetailItem
                      icon={<Radio className="w-4 h-4" />}
                      label="VHF kanaal"
                      value={sluis.vhf}
                    />
                  )}
                  {sluis.openingstijden && (
                    <DetailItem
                      icon={<Clock className="w-4 h-4" />}
                      label="Openingstijden"
                      value={sluis.openingstijden}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Coordinates */}
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm">
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)]">Locatie</h2>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Coordinaten: {sluis.lat.toFixed(6)}, {sluis.lon.toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=&layer=c&cbll=${sluis.lat},${sluis.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-light)] text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Bekijk in Google Street View
                </a>
              </div>
            </div>

            {/* Seamark data */}
            {sluis.tags && (() => {
              const seamark = parseSeamarkTags(sluis.tags);
              if (!seamark) return null;
              const entries = Object.entries(seamark);
              if (entries.length === 0) return null;
              return (
                <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm">
                  <div className="px-6 py-4 border-b border-[var(--border)]">
                    <h2 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                      <Info className="w-4 h-4 text-[var(--primary)]" />
                      Seamark gegevens
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {entries.map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="text-[var(--muted)] text-xs uppercase tracking-wide block">
                            {key.replace(/^seamark:/, "").replace(/[_:]/g, " ")}
                          </span>
                          <span className="text-[var(--foreground)] font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* External links */}
            {(sluis.website || sluis.wikipedia) && (
              <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm">
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="font-semibold text-[var(--foreground)]">
                    Externe bronnen
                  </h2>
                </div>
                <div className="p-6 space-y-3">
                  {sluis.website && (
                    <a
                      href={sluis.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-light)] text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Website
                    </a>
                  )}
                  {sluis.wikipedia && (
                    <a
                      href={wikipediaUrl(sluis.wikipedia)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent-light)] text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Wikipedia
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mini map sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden sticky top-4">
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[var(--foreground)]">Locatie op kaart</h2>
              </div>
              <div className="h-64">
                <MiniMap sluis={sluis} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[var(--primary)] mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-[var(--muted)] uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}
