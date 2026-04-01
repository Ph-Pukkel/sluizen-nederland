"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { Sluis, sluisDisplayNaam } from "@/lib/types";
import { typeColor, typeLabel, bedieningLabel } from "@/lib/utils";
import type { MapBounds } from "@/lib/utils";

// Fix default marker icons for Leaflet in bundled environments
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createCircleIcon(color: string) {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createPopupContent(sluis: Sluis): string {
  const naam = sluisDisplayNaam(sluis);
  return `
    <div style="padding:12px;font-family:system-ui,-apple-system,sans-serif;min-width:200px;">
      <a href="/sluis/${sluis.id.split('/').map(encodeURIComponent).join('/')}" style="color:#003366;font-weight:600;font-size:15px;text-decoration:none;display:block;margin-bottom:4px;">
        ${naam}
      </a>
      <div style="color:#64748b;font-size:12px;margin-bottom:8px;">
        ${sluis.gemeente ? `${sluis.gemeente}, ` : ""}${sluis.provincie}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="background:${typeColor(sluis.type)};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${typeLabel(sluis.type)}</span>
        <span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:11px;">${bedieningLabel(sluis.bediening)}</span>
      </div>
      ${sluis.lengte ? `<div style="font-size:12px;color:#64748b;">Afmeting: ${sluis.lengte}m x ${sluis.breedte ?? "?"}m</div>` : ""}
      ${sluis.eigenaar ? `<div style="font-size:12px;color:#64748b;">Beheerder: ${sluis.eigenaar}</div>` : ""}
    </div>
  `;
}

interface MapComponentProps {
  sluizen: Sluis[];
  onSluisSelect?: (sluis: Sluis) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
}

export default function MapComponent({ sluizen, onSluisSelect, onBoundsChange }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      minZoom: 6,
      maxZoom: 18,
      zoomControl: true,
    });
    // Start with full Netherlands in view, regardless of container size
    map.fitBounds([[50.75, 3.35], [53.55, 7.23]]);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add legend
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "");
      div.style.cssText =
        "background:white;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-size:12px;font-family:system-ui;line-height:1.6;";
      div.innerHTML = `
        <div style="font-weight:600;margin-bottom:4px;color:#1e293b;">Type</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#2563eb;display:inline-block;"></span> Sluis / Schutsluis</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#16a34a;display:inline-block;"></span> Stuw</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#7c3aed;display:inline-block;"></span> Gemaal</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#ea580c;display:inline-block;"></span> Spuisluis</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#06b6d4;display:inline-block;"></span> Sluisdeur</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#ec4899;display:inline-block;"></span> Vispassage</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#6b7280;display:inline-block;"></span> Overig</div>
      `;
      return div;
    };
    legend.addTo(map);

    // Emit initial bounds after layout has settled
    map.whenReady(() => {
      map.invalidateSize();
      // Small delay to allow flexbox layout to finalize container dimensions
      setTimeout(() => {
        const b = map.getBounds();
        onBoundsChangeRef.current?.({
          minLat: b.getSouth(),
          minLon: b.getWest(),
          maxLat: b.getNorth(),
          maxLon: b.getEast(),
        });
      }, 50);
    });

    // Emit bounds on moveend (covers both pan and zoom)
    map.on("moveend", () => {
      const b = map.getBounds();
      onBoundsChangeRef.current?.({
        minLat: b.getSouth(),
        minLon: b.getWest(),
        maxLat: b.getNorth(),
        maxLon: b.getEast(),
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 14,
    });

    for (const sluis of sluizen) {
      const marker = L.marker([sluis.lat, sluis.lon], {
        icon: createCircleIcon(typeColor(sluis.type)),
      });

      marker.bindPopup(createPopupContent(sluis), {
        maxWidth: 280,
        closeButton: true,
      });

      if (onSluisSelect) {
        marker.on("click", () => onSluisSelect(sluis));
      }

      clusterGroup.addLayer(marker);
    }

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
  }, [sluizen, onSluisSelect]);

  useEffect(() => {
    updateMarkers();
  }, [updateMarkers]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: "400px" }} />
  );
}
