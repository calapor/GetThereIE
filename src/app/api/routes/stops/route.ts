import { NextRequest, NextResponse } from "next/server";
import { getStopsForRoute } from "@/lib/gtfs-db";

export async function GET(req: NextRequest) {
  const routeId = req.nextUrl.searchParams.get("routeId")?.trim() ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!routeId) return NextResponse.json([]);
  return NextResponse.json(getStopsForRoute(routeId, q));
}
