import { NextRequest, NextResponse } from "next/server";
import { getStopName, getStopInfo, getLineForStop } from "@/lib/gtfs-db";
import { getBusesForStop } from "@/lib/nta";
import { getLuasForecastForStop } from "@/lib/luas";
import { getPredictionsForBuses } from "@/lib/predictions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  try {
    const info = getStopInfo(stopId);

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

    const predictions = await getPredictionsForBuses(stopId, buses);
    const enriched = buses.map((b) => {
      const pred = predictions.get(b.tripId);
      if (!pred) return b;
      return {
        ...b,
        stopProbability: pred.stopProbability,
        onTimeProbability: pred.onTimeProbability,
        fullnessProbability: pred.fullnessProbability,
        predictionFactors: pred.predictionFactors,
        predictionSampleCount: pred.predictionSampleCount,
      };
    });

    return NextResponse.json({ stopId, stopName, mode: "bus", fetchedAt: new Date().toISOString(), buses: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
