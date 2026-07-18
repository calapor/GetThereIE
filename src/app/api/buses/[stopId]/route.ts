import { NextRequest, NextResponse } from "next/server";
import { getStopName, getStopInfo, getLineForStop } from "@/lib/gtfs-db";
import { getBusesForStop } from "@/lib/nta";
import { getLuasForecastForStop } from "@/lib/luas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  try {
    const info = getStopInfo(stopId);

    // Luas stops are served by the RPA forecast API, not the NTA feed.
    if (info?.mode === "luas" && info.abbrev) {
      const line = getLineForStop(stopId) ?? "";
      const buses = await getLuasForecastForStop(info.abbrev, line);
      return NextResponse.json({
        stopId,
        stopName: info.name ?? stopId,
        mode: "luas",
        fetchedAt: new Date().toISOString(),
        buses,
      });
    }

    const [buses, stopName] = await Promise.all([
      getBusesForStop(stopId),
      Promise.resolve(info?.name ?? getStopName(stopId) ?? stopId),
    ]);
    // TODO(ai-predict): enrich response with late/full predictions — see docs/ai-predictions.md
    return NextResponse.json({ stopId, stopName, mode: "bus", fetchedAt: new Date().toISOString(), buses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
