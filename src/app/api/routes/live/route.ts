import { NextRequest, NextResponse } from "next/server";

// Dummy live trips data
const dummyTrips = [
  {
    tripId: "trip_1",
    routeShortName: "14",
    headsign: "Tallaght",
    directionId: 0,
    nextStopId: "stop_123",
    nextStopName: "O'Connell Street",
    minutesAway: 3,
    delayMinutes: 2,
  },
  {
    tripId: "trip_2",
    routeShortName: "14",
    headsign: "Tallaght",
    directionId: 0,
    nextStopId: "stop_124",
    nextStopName: "Dame Street",
    minutesAway: 9,
    delayMinutes: 1,
  },
  {
    tripId: "trip_3",
    routeShortName: "14",
    headsign: "Tallaght",
    directionId: 0,
    nextStopId: "stop_125",
    nextStopName: "Aungier Street",
    minutesAway: 16,
    delayMinutes: -2,
  },
];

// "Live now" overview for a route: each active bus and the next stop it is
// approaching. `route` is the route short name (e.g. "14").
export async function GET(req: NextRequest) {
  const route = req.nextUrl.searchParams.get("route")?.trim() ?? "";
  if (!route) return NextResponse.json({ error: "route is required" }, { status: 400 });

  // Return dummy trips for all routes
  const trips = dummyTrips.filter((t) => t.routeShortName === route);
  return NextResponse.json({ route, fetchedAt: new Date().toISOString(), trips });
}
