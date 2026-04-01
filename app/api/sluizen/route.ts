import type { NextRequest } from "next/server";
import { filterSluizen, countFilteredSluizen, getFilterOptions } from "@/lib/db";
import type { Bounds } from "@/lib/db";
import { defaultFilters, type FilterState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Return filter options if requested
  if (searchParams.get("options") === "true") {
    const provParam = searchParams.getAll("provincie");
    const options = getFilterOptions(
      provParam.length > 0 ? provParam : undefined
    );
    return Response.json(options);
  }

  // Parse limit/offset
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "10000"),
    100000
  );
  const offset = parseInt(searchParams.get("offset") || "0");

  // Parse bounds (minLat,minLon,maxLat,maxLon)
  let bounds: Bounds | undefined;
  const boundsParam = searchParams.get("bounds");
  if (boundsParam) {
    const parts = boundsParam.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      bounds = { minLat: parts[0], minLon: parts[1], maxLat: parts[2], maxLon: parts[3] };
    }
  }

  // Check if there are actual filter params (not just limit/offset/bounds)
  const hasFilters = Array.from(searchParams.keys()).some(
    (k) => !["options", "limit", "offset", "bounds"].includes(k)
  );

  // Parse filters from query params
  const filters: FilterState = {
    ...defaultFilters,
    zoek: searchParams.get("zoek") || "",
    provincie: searchParams.getAll("provincie"),
    gemeente: searchParams.getAll("gemeente"),
    waterschap: searchParams.getAll("waterschap"),
    categorie: searchParams.getAll("categorie"),
    bron: searchParams.getAll("bron"),
    eigenaar: searchParams.getAll("eigenaar"),
    lengteMin: Number(searchParams.get("lengteMin")) || 0,
    lengteMax: Number(searchParams.get("lengteMax")) || 500,
    breedteMin: Number(searchParams.get("breedteMin")) || 0,
    breedteMax: Number(searchParams.get("breedteMax")) || 100,
    bouwjaarMin: Number(searchParams.get("bouwjaarMin")) || 1500,
    bouwjaarMax: Number(searchParams.get("bouwjaarMax")) || 2030,
    heeftOpeningstijden: searchParams.get("heeftOpeningstijden") === "true",
    heeftVhf: searchParams.get("heeftVhf") === "true",
    heeftNaam: searchParams.get("heeftNaam") === "true",
    heeftAfmetingen: searchParams.get("heeftAfmetingen") === "true",
    heeftBeheerder: searchParams.get("heeftBeheerder") === "true",
    sortering:
      (searchParams.get("sortering") as FilterState["sortering"]) || "naam",
  };

  if (!hasFilters) {
    filters.categorie = [];
  }

  const totalCount = countFilteredSluizen(filters, bounds);
  const sluizen = filterSluizen(filters, limit, offset, bounds);

  return Response.json({
    data: sluizen,
    total_count: totalCount,
    limit,
    offset,
  });
}
