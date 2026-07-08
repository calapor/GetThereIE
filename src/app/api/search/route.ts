import { NextRequest, NextResponse } from "next/server";

// Dummy routes data
const dummyRoutes = [
  { id: "route_14", name: "14", shortName: "14", headsign: "Tallaght" },
  { id: "route_15", name: "15", shortName: "15", headsign: "Ballymun" },
  { id: "route_25", name: "25", shortName: "25", headsign: "Dun Laoghaire" },
  { id: "route_46a", name: "46a", shortName: "46a", headsign: "Dun Laoghaire" },
  { id: "route_11", name: "11", shortName: "11", headsign: "Finglas" },
  { id: "route_39", name: "39", shortName: "39", headsign: "Blanchardstown" },
  { id: "route_5", name: "5", shortName: "5", headsign: "Rathmines" },
  { id: "route_7", name: "7", shortName: "7", headsign: "Drimnagh" },
  { id: "route_9", name: "9", shortName: "9", headsign: "Ballymun" },
  { id: "route_83", name: "83", shortName: "83", headsign: "Clonshaugh" },
  { id: "route_84", name: "84", shortName: "84", headsign: "Ballymun" },
  { id: "route_27", name: "27", shortName: "27", headsign: "Jobstown" },
  { id: "route_123", name: "123", shortName: "123", headsign: "Dun Laoghaire" },
];

// Dummy stops data
const dummyStops = [
  { id: "stop_1", name: "O'Connell Street", lat: 53.3489, lon: -6.2586 },
  { id: "stop_2", name: "Dame Street", lat: 53.3447, lon: -6.2626 },
  { id: "stop_3", name: "Grafton Street", lat: 53.3427, lon: -6.2619 },
  { id: "stop_4", name: "Merrion Square", lat: 53.3409, lon: -6.2555 },
  { id: "stop_5", name: "College Green", lat: 53.3445, lon: -6.2593 },
  { id: "stop_6", name: "Westmoreland Street", lat: 53.3461, lon: -6.2596 },
  { id: "stop_7", name: "Temple Bar", lat: 53.3435, lon: -6.2687 },
  { id: "stop_8", name: "Smithfield", lat: 53.3475, lon: -6.2874 },
  { id: "stop_9", name: "Blanchardstown", lat: 53.3787, lon: -6.3762 },
  { id: "stop_10", name: "Dun Laoghaire", lat: 53.2965, lon: -6.1360 },
  { id: "stop_11", name: "Tallaght", lat: 53.2865, lon: -6.3643 },
  { id: "stop_12", name: "Ballymun", lat: 53.3839, lon: -6.2261 },
  { id: "stop_13", name: "Finglas", lat: 53.3933, lon: -6.3085 },
  { id: "stop_14", name: "Rathmines", lat: 53.3287, lon: -6.2703 },
  { id: "stop_15", name: "Phibsborough", lat: 53.3569, lon: -6.2698 },
];

// Combined typeahead: one round-trip returning both routes and stops so the
// unified search box can render grouped results without two requests.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ routes: [], stops: [] });

  const lowerQ = q.toLowerCase();

  // Filter routes by name or shortName
  const routes = dummyRoutes
    .filter((r) => r.shortName.includes(q) || r.headsign.toLowerCase().includes(lowerQ))
    .slice(0, 8);

  // Filter stops by name (need at least 2 chars)
  const stops = q.length >= 2 ? dummyStops.filter((s) => s.name.toLowerCase().includes(lowerQ)).slice(0, 8) : [];

  return NextResponse.json({ routes, stops });
}
