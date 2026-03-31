import type { NextRequest } from "next/server";
import { computeStatistieken } from "@/lib/db";
import { defaultFilters, type FilterState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  if (!hasFilters) {
    const stats = computeStatistieken();
    return Response.json(stats);
  }

  const filters: FilterState = {
    ...defaultFilters,
    zoek: searchParams.get("zoek") || "",
    provincie: searchParams.getAll("provincie"),
    gemeente: searchParams.getAll("gemeente"),
    type: searchParams.getAll("type"),
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

  const stats = computeStatistieken(filters);
  return Response.json(stats);
}
