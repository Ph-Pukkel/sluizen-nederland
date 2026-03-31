import { computeStatistieken } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = computeStatistieken();
  return Response.json(stats);
}
