import { NextResponse } from "next/server";
import { transit_realtime } from "gtfs-realtime-bindings";

export async function GET() {
  const apiKey = process.env.NTA_API_KEY ?? "";
  const res = await fetch("https://api.nationaltransport.ie/gtfsr/v2/TripUpdates", {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json({ error: `NTA API ${res.status}: ${body}` }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buf));

  const TARGET_STOP = "8250DB001306";
  const now = Math.floor(Date.now() / 1000);

  // Find any entries with non-zero arrival times
  const withRealTimes = feed.entity.filter((e) =>
    e.tripUpdate?.stopTimeUpdate?.some((s) => Number(s.arrival?.time ?? 0) > 0 || Number(s.departure?.time ?? 0) > 0)
  );

  // Find entries mentioning the target stop
  const forTargetStop = feed.entity
    .filter((e) => e.tripUpdate?.stopTimeUpdate?.some((s) => s.stopId === TARGET_STOP))
    .map((e) => ({
      id: e.id,
      tripId: e.tripUpdate?.trip?.tripId,
      routeId: e.tripUpdate?.trip?.routeId,
      stopTimeUpdates: e.tripUpdate?.stopTimeUpdate
        ?.filter((s) => s.stopId === TARGET_STOP)
        .map((s) => ({
          stopSequence: s.stopSequence,
          stopId: s.stopId,
          arrivalTime: s.arrival?.time?.toString(),
          departureTime: s.departure?.time?.toString(),
          scheduleRelationship: s.scheduleRelationship,
        })),
    }));

  // Sample of entries that DO have real times
  const realTimeSample = withRealTimes.slice(0, 2).map((e) => ({
    id: e.id,
    tripId: e.tripUpdate?.trip?.tripId,
    routeId: e.tripUpdate?.trip?.routeId,
    stopTimeUpdates: e.tripUpdate?.stopTimeUpdate?.slice(0, 3).map((s) => ({
      stopSequence: s.stopSequence,
      stopId: s.stopId,
      arrivalTime: s.arrival?.time?.toString(),
      departureTime: s.departure?.time?.toString(),
      scheduleRelationship: s.scheduleRelationship,
    })),
  }));

  return NextResponse.json({
    entityCount: feed.entity.length,
    nowUnix: now,
    entriesWithRealTimes: withRealTimes.length,
    realTimeSample,
    targetStop: TARGET_STOP,
    tripsForTargetStop: forTargetStop.length,
    forTargetStop,
  });
}
