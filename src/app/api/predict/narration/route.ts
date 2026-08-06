import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateNarration } from "@/lib/narration";

export const dynamic = "force-dynamic";

const NARRATION_TTL_MS = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const routeId = searchParams.get("routeId");
  const stopId = searchParams.get("stopId");
  const factors = (searchParams.get("factors") ?? "").split(",").filter(Boolean);
  const stopP = parseFloat(searchParams.get("stopP") ?? "0.7");
  const onTimeP = parseFloat(searchParams.get("onTimeP") ?? "0.6");
  const fullP = parseFloat(searchParams.get("fullP") ?? "0.3");

  if (!routeId || !stopId) {
    return NextResponse.json({ error: "Missing routeId or stopId" }, { status: 400 });
  }

  // Round to nearest 10% so similar conditions share a cache entry
  const bucket = `${Math.round(stopP * 10)}-${Math.round(onTimeP * 10)}-${Math.round(fullP * 10)}-${[...factors].sort().join(",")}`;
  const key = `${routeId}:${stopId}:${bucket}`;

  const cached = await prisma.narrationCache.findUnique({ where: { key } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < NARRATION_TTL_MS) {
    return NextResponse.json({ text: cached.text, cached: true });
  }

  try {
    const text = await generateNarration(routeId, stopId, factors, stopP, onTimeP, fullP);
    await prisma.narrationCache.upsert({
      where: { key },
      create: { key, text, fetchedAt: new Date() },
      update: { text, fetchedAt: new Date() },
    });
    return NextResponse.json({ text, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate narration";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
