import { NextRequest, NextResponse } from "next/server";
import { nearbyStops } from "@/lib/gtfs-db";

// Nearest Dublin Bus stops to a lat/lon, sorted by distance.
export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }
  return NextResponse.json(nearbyStops(lat, lon));
}
