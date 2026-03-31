"use client";

import Link from "next/link";
import { Sluis, sluisDisplayNaam } from "@/lib/types";
import { bedieningLabel, bedieningColor, typeColor, typeLabel } from "@/lib/utils";
import {
  MapPin,
  Ruler,
  Radio,
  Clock,
  Building2,
  ExternalLink,
} from "lucide-react";

interface SluisCardProps {
  sluis: Sluis;
  compact?: boolean;
}

export default function SluisCard({ sluis, compact = false }: SluisCardProps) {
  return (
    <div className="bg-white rounded-lg border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <Link
              href={`/sluis/${encodeURIComponent(sluis.id)}`}
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
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
            style={{ backgroundColor: bedieningColor(sluis.bediening) }}
          >
            {bedieningLabel(sluis.bediening)}
          </span>
        </div>

        <div className="text-sm text-[var(--foreground)] mb-2">
          <span
            className="text-white px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: typeColor(sluis.type) }}
          >
            {typeLabel(sluis.type)}
          </span>
        </div>

        {!compact && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-3">
              {sluis.lengte != null && (
                <div className="flex items-center gap-1.5 text-[var(--muted)]">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>
                    {sluis.lengte}m x {sluis.breedte ?? "?"}m
                  </span>
                </div>
              )}
              {sluis.eigenaar && (
                <div className="flex items-center gap-1.5 text-[var(--muted)]">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="truncate">{sluis.eigenaar}</span>
                </div>
              )}
              {sluis.vhf && (
                <div className="flex items-center gap-1.5 text-[var(--muted)]">
                  <Radio className="w-3.5 h-3.5" />
                  <span>VHF {sluis.vhf}</span>
                </div>
              )}
              {sluis.openingstijden && (
                <div className="flex items-center gap-1.5 text-[var(--muted)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="truncate">Openingstijden</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <Link
                href={`/sluis/${encodeURIComponent(sluis.id)}`}
                className="text-sm text-[var(--accent)] hover:text-[var(--accent-light)] font-medium flex items-center gap-1"
              >
                Bekijk details
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
