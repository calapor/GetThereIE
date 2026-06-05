import { NextRequest, NextResponse } from "next/server";
import { getBusesForStop } from "@/lib/nta";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;

  try {
    const buses = await getBusesForStop(stopId);

    // Enrich each bus with historical stopped % from past reports
    const enriched = await Promise.all(
      buses.map(async (bus) => {
        const reports = await prisma.report.findMany({
          where: { stopId, routeId: bus.routeId, type: "STOPPED" },
        });
        const historical =
          reports.length === 0
            ? null
            : Math.round(
                (reports.filter((r) => r.vote).length / reports.length) * 100
              );
        return { ...bus, historicalStopPct: historical };
      })
    );

    return NextResponse.json({ stopId, fetchedAt: new Date().toISOString(), buses: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
