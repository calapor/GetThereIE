import { NextRequest, NextResponse } from "next/server";
import { searchRoutes, searchStops } from "@/lib/gtfs-db";

// Combined typeahead: one round-trip returning both routes and stops so the
// unified search box can render grouped results without two requests.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ routes: [], stops: [] });

  const routes = searchRoutes(q, 8);
  // Stop names need at least 2 chars to be meaningful.
  const stops = q.length >= 2 ? searchStops(q, 8) : [];

  return NextResponse.json({ routes, stops });
}
