import { NextRequest, NextResponse } from "next/server";
import { searchRoutes, searchStops, getHeadsignForRoute } from "@/lib/gtfs-db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ routes: [], stops: [] });

  const routes = searchRoutes(q, 8).map((r) => ({
    route_id: r.route_id,
    route_short_name: r.route_short_name,
    route_long_name: r.route_long_name,
    id: r.route_id,
    name: r.route_short_name,
    shortName: r.route_short_name,
    headsign: getHeadsignForRoute(r.route_short_name, 0) ?? r.route_long_name,
  }));

  const stops = q.length >= 2
    ? searchStops(q, 8).map((s) => ({
        stop_id: s.stop_id,
        stop_name: s.stop_name,
        stop_lat: s.stop_lat,
        stop_lon: s.stop_lon,
        id: s.stop_id,
        name: s.stop_name,
      }))
    : [];

  return NextResponse.json({ routes, stops });
}
