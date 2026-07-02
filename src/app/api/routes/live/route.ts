import { NextRequest, NextResponse } from "next/server";
import { getLiveTripsForRoute } from "@/lib/nta";

// "Live now" overview for a route: each active bus and the next stop it is
// approaching. `route` is the route short name (e.g. "14").
export async function GET(req: NextRequest) {
  const route = req.nextUrl.searchParams.get("route")?.trim() ?? "";
  if (!route) return NextResponse.json({ error: "route is required" }, { status: 400 });

  try {
    const trips = await getLiveTripsForRoute(route);
    return NextResponse.json({ route, fetchedAt: new Date().toISOString(), trips });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch live feed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
