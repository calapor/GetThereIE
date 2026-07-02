import { NextRequest, NextResponse } from "next/server";
import { searchStops } from "@/lib/gtfs-db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  return NextResponse.json(searchStops(q));
}
