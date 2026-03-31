import type { NextRequest } from "next/server";
import { getSluisById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  const { id } = await params;
  const fullId = id.join("/");
  const sluis = getSluisById(fullId);

  if (!sluis) {
    return Response.json({ error: "Sluis niet gevonden" }, { status: 404 });
  }

  return Response.json(sluis);
}
