import { NextRequest, NextResponse } from "next/server";
import { getRouteDirections } from "@/lib/gtfs-db";

export async function GET(req: NextRequest) {
  const routeId = req.nextUrl.searchParams.get("routeId")?.trim() ?? "";
  if (!routeId) return NextResponse.json([]);
  return NextResponse.json(getRouteDirections(routeId));
}
