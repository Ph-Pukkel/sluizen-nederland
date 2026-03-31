import { getFeaturedSluizen } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const featured = getFeaturedSluizen(6);
  return Response.json(featured);
}
