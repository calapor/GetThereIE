import { transit_realtime } from "gtfs-realtime-bindings";

const NTA_BASE_URL = "https://api.nationaltransport.ie/gtfsr/v2";

const FEED_TTL_MS = 15_000;

let cachedFeed: transit_realtime.FeedMessage | null = null;
let cachedAt = 0;
let inFlight: Promise<transit_realtime.FeedMessage> | null = null;

export interface BusArrival {
  tripId: string;
  routeId: string;
  directionId: number;
  arrivalTimestamp: number;
  arrivalTime: string;
  minutesAway: number;
  delaySeconds: number;
  delayMinutes: number;
  isStopping: boolean;
  occupancyStatus: string | null;
  stopId: string;
}

async function downloadFeed(): Promise<transit_realtime.FeedMessage> {
  const apiKey = process.env.NTA_API_KEY ?? "";
  const res = await fetch(`${NTA_BASE_URL}/TripUpdates`, {
    headers: { "x-api-key": apiKey, "Cache-Control": "no-cache" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    if (cachedFeed) {
      console.warn(`NTA API ${res.status}; serving cached feed from ${new Date(cachedAt).toISOString()}`);
      return cachedFeed;
    }
    throw new Error(`NTA API ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buf));
  cachedFeed = feed;
  cachedAt = Date.now();
  return feed;
}

async function fetchFeed(): Promise<transit_realtime.FeedMessage> {
  if (cachedFeed && Date.now() - cachedAt < FEED_TTL_MS) {
    return cachedFeed;
  }
  if (inFlight) return inFlight;
  inFlight = downloadFeed().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getBusesForStop(stopId: string): Promise<BusArrival[]> {
  const feed = await fetchFeed();
  const now = Math.floor(Date.now() / 1000);
  const upcoming: BusArrival[] = [];

  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;

    for (const stu of tu.stopTimeUpdate) {
      if (stu.stopId !== stopId) continue;

      const isSkipped =
        stu.scheduleRelationship ===
        transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED;

      const arrival = stu.arrival ?? stu.departure;
      if (!arrival?.time) break;

      const eta = Number(arrival.time);
      if (eta <= now) break;

      const delay = Number(arrival.delay ?? 0);
      const minutesAway = Math.max(0, Math.floor((eta - now) / 60));

      const d = new Date(eta * 1000);
      const arrivalTime = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

      const trip = tu.trip;
      const routeId =
        trip?.routeId || trip?.tripId?.split("_")[0] || "unknown";

      upcoming.push({
        tripId: trip?.tripId ?? entity.id,
        routeId,
        directionId: Number(trip?.directionId ?? 0),
        arrivalTimestamp: eta,
        arrivalTime,
        minutesAway,
        delaySeconds: delay,
        delayMinutes: Math.round(delay / 60),
        isStopping: !isSkipped,
        occupancyStatus: null,
        stopId,
      });
      break;
    }
  }

  upcoming.sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);
  return upcoming;
}
