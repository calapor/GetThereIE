import { NextRequest, NextResponse } from "next/server";
import { getLiveTripsForRoute } from "@/lib/nta";
import { getLuasLineOverview } from "@/lib/luas";

// "Live now" overview for a route. Buses come from the NTA vehicle feed; Luas
// lines (Red/Green) come from a bounded fan-out over the RPA forecast API.
export async function GET(req: NextRequest) {
  const route = req.nextUrl.searchParams.get("route")?.trim() ?? "";
  if (!route) return NextResponse.json({ error: "route is required" }, { status: 400 });

  try {
    const isLuas = route.toLowerCase() === "red" || route.toLowerCase() === "green";

    if (isLuas) {
      const trams = await getLuasLineOverview(route);
      const trips = trams.map((t, i) => ({
        tripId: `luas-${route}-${i}`,
        routeShortName: route,
        headsign: t.destination,
        directionId: t.directionId,
        nextStopId: t.fromStopId,
        nextStopName: t.fromStop,
        minutesAway: t.minutesAway,
        delayMinutes: 0,
      }));
      return NextResponse.json({ route, mode: "luas", fetchedAt: new Date().toISOString(), trips });
    }

    const trips = await getLiveTripsForRoute(route);
    return NextResponse.json({ route, mode: "bus", fetchedAt: new Date().toISOString(), trips });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
