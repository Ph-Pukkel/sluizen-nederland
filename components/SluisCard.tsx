"use client";

import Link from "next/link";
import { Sluis, sluisDisplayNaam } from "@/lib/types";
import { bedieningLabel, bedieningColor, typeColor, typeLabel, categorieLabel, bronLabel, wikipediaUrl } from "@/lib/utils";
import {
  MapPin,
  Ruler,
  Radio,
  Clock,
  Building2,
  Calendar,
  ExternalLink,
  Waves,
  ArrowUpFromLine,
  Camera,
  Info,
} from "lucide-react";

interface SluisCardProps {
  sluis: Sluis;
  compact?: boolean;
}

export default function SluisCard({ sluis, compact = false }: SluisCardProps) {
  return (
    <div className="bg-white rounded-lg border border-[var(--border)] shadow-sm">
      <div className="p-4">
        {/* Header: name + location */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <Link
              href={`/sluis/${sluis.id.split('/').map(encodeURIComponent).join('/')}`}
              className="text-base font-semibold text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors"
            >
              {sluisDisplayNaam(sluis)}
            </Link>
            <div className="flex items-center gap-1 text-sm text-[var(--muted)] mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {sluis.gemeente ? `${sluis.gemeente}, ` : ""}
                {sluis.provincie}
              </span>
            </div>
          </div>
        </div>

        {/* Type + bediening badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span
            className="text-white px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: typeColor(sluis.type) }}
          >
            {typeLabel(sluis.type)}
          </span>
          <span
            className="text-white px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: bedieningColor(sluis.bediening) }}
          >
            {bedieningLabel(sluis.bediening)}
          </span>
          {sluis.categorie && sluis.categorie !== sluis.type && (
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">
              {categorieLabel(sluis.categorie)}
            </span>
          )}
          {sluis.bron && (
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">
              {bronLabel(sluis.bron)}
            </span>
          )}
        </div>

        {/* Photo */}
        {sluis.foto_url && (
          <div className="mb-3 rounded overflow-hidden">
            <img
              src={sluis.foto_url}
              alt={sluisDisplayNaam(sluis)}
              className="w-full h-40 object-cover"
              loading="lazy"
            />
            {sluis.foto_bron && (
              <p className="text-xs text-[var(--muted)] mt-1 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {sluis.foto_bron}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {sluis.beschrijving && (
          <p className="text-sm text-[var(--foreground)] mb-3 leading-relaxed">
            {sluis.beschrijving}
          </p>
        )}

        {!compact && (
          <>
            {/* All detail fields */}
            <div className="grid grid-cols-1 gap-2 text-sm">
              {sluis.lengte != null && (
                <DetailRow icon={<Ruler className="w-3.5 h-3.5" />} label="Afmetingen">
                  {sluis.lengte}m x {sluis.breedte ?? "?"}m
                </DetailRow>
              )}
              {sluis.diepte != null && (
                <DetailRow icon={<Waves className="w-3.5 h-3.5" />} label="Diepte">
                  {sluis.diepte}m
                </DetailRow>
              )}
              {sluis.maxhoogte != null && (
                <DetailRow icon={<ArrowUpFromLine className="w-3.5 h-3.5" />} label="Max. doorvaarthoogte">
                  {sluis.maxhoogte}m
                </DetailRow>
              )}
              {sluis.eigenaar && (
                <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label="Beheerder">
                  {sluis.eigenaar}
                </DetailRow>
              )}
              {sluis.bouwjaar && (
                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Bouwjaar">
                  {String(sluis.bouwjaar)}
                </DetailRow>
              )}
              {sluis.vhf && (
                <DetailRow icon={<Radio className="w-3.5 h-3.5" />} label="VHF kanaal">
                  {sluis.vhf}
                </DetailRow>
              )}
              {sluis.openingstijden && (
                <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Openingstijden">
                  {sluis.openingstijden}
                </DetailRow>
              )}
              <DetailRow icon={<Info className="w-3.5 h-3.5" />} label="Coordinaten">
                {sluis.lat.toFixed(5)}, {sluis.lon.toFixed(5)}
              </DetailRow>
            </div>

            {/* External links */}
            {(sluis.website || sluis.wikipedia) && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap gap-3">
                {sluis.website && (
                  <a
                    href={sluis.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--accent)] hover:text-[var(--accent-light)] font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Website
                  </a>
                )}
                {sluis.wikipedia && (
                  <a
                    href={wikipediaUrl(sluis.wikipedia)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--accent)] hover:text-[var(--accent-light)] font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Wikipedia
                  </a>
                )}
              </div>
            )}

            {/* Detail page link */}
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <Link
                href={`/sluis/${sluis.id.split('/').map(encodeURIComponent).join('/')}`}
                className="text-sm text-[var(--accent)] hover:text-[var(--accent-light)] font-medium flex items-center gap-1"
              >
                Volledige detailpagina
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[var(--muted)]">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <span className="text-xs uppercase tracking-wide block">{label}</span>
        <span className="text-[var(--foreground)] font-medium">{children}</span>
      </div>
    </div>
  );
}
