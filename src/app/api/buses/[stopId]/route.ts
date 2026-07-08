import { NextRequest, NextResponse } from "next/server";
import { getStopName } from "@/lib/gtfs-db";

// Dummy buses data
const dummyBuses = [
  {
    tripId: "trip_1",
    routeId: "route_14",
    routeShortName: "14",
    headsign: "Tallaght",
    delayMinutes: 2,
    minutesAway: 3,
    historicalStopPct: 65,
  },
  {
    tripId: "trip_2",
    routeId: "route_15",
    routeShortName: "15",
    headsign: "Ballymun",
    delayMinutes: -1,
    minutesAway: 8,
    historicalStopPct: 72,
  },
  {
    tripId: "trip_3",
    routeId: "route_46a",
    routeShortName: "46a",
    headsign: "Dun Laoghaire",
    delayMinutes: 4,
    minutesAway: 12,
    historicalStopPct: null,
  },
  {
    tripId: "trip_4",
    routeId: "route_11",
    routeShortName: "11",
    headsign: "Finglas",
    delayMinutes: 0,
    minutesAway: 18,
    historicalStopPct: 68,
  },
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;

  try {
    // Return dummy buses for all stops
    const stopName = getStopName(stopId) ?? stopId;
    return NextResponse.json({ stopId, stopName, fetchedAt: new Date().toISOString(), buses: dummyBuses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
