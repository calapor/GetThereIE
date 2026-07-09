import { NextRequest, NextResponse } from "next/server";
import { searchRoutes, searchStops, getHeadsignForRoute, getRouteEndpoints } from "@/lib/gtfs-db";
import { getActiveCountsByRoute } from "@/lib/nta";

// A Luas line if the short name is "Red"/"Green"; otherwise a bus.
function modeFor(shortName: string): "bus" | "luas" {
  const s = shortName.trim().toLowerCase();
  return s === "red" || s === "green" ? "luas" : "bus";
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ routes: [], stops: [] });

  // Live counts come from the cached RT feed — tolerate feed/DB absence.
  const counts = await getActiveCountsByRoute().catch(() => ({} as Record<string, number>));

  const routes = searchRoutes(q, 8).map((r) => ({
    route_id: r.route_id,
    route_short_name: r.route_short_name,
    route_long_name: r.route_long_name,
    id: r.route_id,
    name: r.route_short_name,
    shortName: r.route_short_name,
    mode: (r as { mode?: "bus" | "luas" }).mode ?? modeFor(r.route_short_name),
    headsign: getHeadsignForRoute(r.route_short_name, 0) ?? r.route_long_name,
    endpoints: getRouteEndpoints(r.route_short_name),
    liveCount: counts[r.route_short_name] ?? 0,
  }));

  const stops = q.length >= 2
    ? searchStops(q, 8).map((s) => ({
        stop_id: s.stop_id,
        stop_name: s.stop_name,
        stop_lat: s.stop_lat,
        stop_lon: s.stop_lon,
        id: s.stop_id,
        name: s.stop_name,
        mode: (s as { mode?: "bus" | "luas" }).mode ?? "bus",
      }))
    : [];

  return NextResponse.json({ routes, stops });
}
