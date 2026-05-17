import { NextRequest, NextResponse } from "next/server";
import { awardPoints } from "@/lib/points";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, stopId, routeId, tripId, type, vote } = body;

  if (!userId || !stopId || !routeId || !tripId || !type || vote === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (type !== "STOPPED" && type !== "ON_TIME") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const result = await awardPoints(userId, stopId, routeId, tripId, type, vote);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
