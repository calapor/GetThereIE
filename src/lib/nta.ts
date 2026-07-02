import { transit_realtime } from "gtfs-realtime-bindings";
import { getScheduledArrivalSecs, getHeadsignForRoute } from "./gtfs-db";
import fs from "fs";
import path from "path";

const NTA_BASE_URL = "https://api.nationaltransport.ie/gtfsr/v2";
const FEED_CACHE_TTL_MS = 25_000;
const FEED_CACHE_PATH = path.join(process.cwd(), ".feed-cache.bin");
const FEED_CACHE_META_PATH = path.join(process.cwd(), ".feed-cache.json");

// In-process memory cache (fast path within a single Node process lifetime)
let memCache: { feed: transit_realtime.FeedMessage; fetchedAt: number } | null = null;

export interface BusArrival {
  tripId: string;
  routeId: string;
  routeShortName: string;
  headsign: string;
  directionId: number;
  arrivalTimestamp: number;
  arrivalTime: string;
  scheduledTime: string;
  minutesAway: number;
  delaySeconds: number;
  delayMinutes: number;
  isStopping: boolean;
  occupancyStatus: string | null;
  stopId: string;
}

async function fetchFeed(): Promise<transit_realtime.FeedMessage> {
  const now = Date.now();

  // 1. Fast path: in-process memory cache
  if (memCache && now - memCache.fetchedAt < FEED_CACHE_TTL_MS) {
    return memCache.feed;
  }

  // 2. Disk cache: survives across Next.js worker restarts / hot-reloads
  try {
    const meta = JSON.parse(fs.readFileSync(FEED_CACHE_META_PATH, "utf8")) as { fetchedAt: number };
    if (now - meta.fetchedAt < FEED_CACHE_TTL_MS) {
      const data = fs.readFileSync(FEED_CACHE_PATH);
      const feed = transit_realtime.FeedMessage.decode(new Uint8Array(data));
      memCache = { feed, fetchedAt: meta.fetchedAt };
      return feed;
    }
  } catch {
    // no cache on disk yet, or corrupt — fall through to fetch
  }

  // 3. Live fetch
  const apiKey = process.env.NTA_API_KEY ?? "";
  const res = await fetch(`${NTA_BASE_URL}/TripUpdates`, {
    headers: { "x-api-key": apiKey, "Cache-Control": "no-cache" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NTA API ${res.status}: ${body}`);
  }
  const buf = await res.arrayBuffer();
  const data = Buffer.from(buf);
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buf));

  // Persist to disk before updating memory cache
  try {
    fs.writeFileSync(FEED_CACHE_PATH, data);
    fs.writeFileSync(FEED_CACHE_META_PATH, JSON.stringify({ fetchedAt: now }));
  } catch {
    // disk write failure is non-fatal
  }

  memCache = { feed, fetchedAt: now };
  return feed;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return (
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

// Converts a GTFS scheduled arrival (seconds from midnight, local time) to a
// Unix timestamp. Relies on the server running in Europe/Dublin timezone.
// Set TZ=Europe/Dublin in production.
function scheduledToUnix(arrivalSecs: number, startDate: string): number {
  const year = parseInt(startDate.slice(0, 4));
  const month = parseInt(startDate.slice(4, 6)) - 1;
  const day = parseInt(startDate.slice(6, 8));
  const midnightLocal = new Date(year, month, day, 0, 0, 0).getTime() / 1000;
  return midnightLocal + arrivalSecs;
}

export async function getBusesForStop(stopId: string): Promise<BusArrival[]> {
  const feed = await fetchFeed();
  const now = Math.floor(Date.now() / 1000);
  const upcoming: BusArrival[] = [];

  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;

    for (const stu of tu.stopTimeUpdate ?? []) {
      if (stu.stopId !== stopId) continue;

      const isSkipped =
        stu.scheduleRelationship ===
        transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED;

      const arrival = stu.arrival ?? stu.departure;
      const rtTime = Number(arrival?.time ?? 0);
      const delay = Number(arrival?.delay ?? 0);

      let eta: number;
      let scheduledUnix: number;

      const tripId = tu.trip?.tripId ?? entity.id;
      const startDate = (tu.trip as any)?.startDate || todayYYYYMMDD();
      const arrivalSecs = getScheduledArrivalSecs(tripId, stopId);

      if (rtTime > 0) {
        eta = rtTime;
        scheduledUnix = arrivalSecs !== null
          ? scheduledToUnix(arrivalSecs, startDate)
          : eta - delay;
      } else {
        if (arrivalSecs === null) break;
        scheduledUnix = scheduledToUnix(arrivalSecs, startDate);
        eta = scheduledUnix + delay;
      }

      if (eta <= now) break;

      const minutesAway = Math.max(0, Math.floor((eta - now) / 60));
      const fmt = (ts: number) => {
        const d = new Date(ts * 1000);
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      };
      const arrivalTime = fmt(eta);
      const scheduledTime = fmt(scheduledUnix);

      const trip = tu.trip;
      const routeId = trip?.routeId || trip?.tripId?.split("_")[0] || "unknown";
      const resolvedTripId = trip?.tripId || entity.id;
      // RT routeId is like "1 74" or "1 15B c a" — second token is the route short name
      const routeShortName = routeId.split(" ")[1] || routeId;
      const dirId = Number(trip?.directionId ?? 0);
      const headsign = getHeadsignForRoute(routeShortName, dirId) ?? "";

      upcoming.push({
        tripId: resolvedTripId,
        routeId,
        routeShortName,
        headsign,
        directionId: Number(trip?.directionId ?? 0),
        arrivalTimestamp: eta,
        arrivalTime,
        scheduledTime,
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
