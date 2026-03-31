import type { NextRequest } from "next/server";
import { getSluisById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const sluis = getSluisById(decodedId);

  if (!sluis) {
    return Response.json({ error: "Sluis niet gevonden" }, { status: 404 });
  }

  return Response.json(sluis);
}
