import { NextRequest, NextResponse } from "next/server";
import { getStopName } from "@/lib/gtfs-db";
import { getBusesForStop } from "@/lib/nta";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  try {
    const [buses, stopName] = await Promise.all([
      getBusesForStop(stopId),
      Promise.resolve(getStopName(stopId) ?? stopId),
    ]);
    return NextResponse.json({ stopId, stopName, fetchedAt: new Date().toISOString(), buses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
