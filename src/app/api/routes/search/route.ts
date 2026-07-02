import { NextRequest, NextResponse } from "next/server";
import { searchRoutes } from "@/lib/gtfs-db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);
  return NextResponse.json(searchRoutes(q));
}
