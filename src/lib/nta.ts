import { transit_realtime } from "gtfs-realtime-bindings";
import { getScheduledArrivalSecs, getHeadsignForRoute, getStopName, getScheduledArrivalsForStop } from "./gtfs-db";
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
  historicalStopPct: number | null;
  stopId: string;
  isScheduled: boolean;
}

async function fetchFeed(): Promise<transit_realtime.FeedMessage> {
  const now = Date.now();

  // 1. Fast path: in-process memory cache
  if (memCache && now - memCache.fetchedAt < FEED_CACHE_TTL_MS) {
    return memCache.feed;
  }

  // 2. Disk cache: survives across Next.js worker restarts / hot-reloads
  let stale: transit_realtime.FeedMessage | null = null;
  try {
    const meta = JSON.parse(fs.readFileSync(FEED_CACHE_META_PATH, "utf8")) as { fetchedAt: number };
    const data = fs.readFileSync(FEED_CACHE_PATH);
    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(data));
    if (now - meta.fetchedAt < FEED_CACHE_TTL_MS) {
      memCache = { feed, fetchedAt: meta.fetchedAt };
      return feed;
    }
    stale = feed; // keep as fallback in case the live fetch fails
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
    // On rate-limit or transient error, serve stale data rather than blowing up.
    if (stale) return stale;
    if (memCache) return memCache.feed;
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
  // sv-SE locale gives YYYY-MM-DD in Dublin time, strip dashes → YYYYMMDD.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Dublin" })
    .format(new Date())
    .replace(/-/g, "");
}

// Seconds elapsed since midnight in Dublin local time.
function dublinSecsSinceMidnight(): number {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
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

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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
      const arrivalTime = fmtTime(eta);
      const scheduledTime = fmtTime(scheduledUnix);

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
        historicalStopPct: null,
        stopId,
        isScheduled: false,
      });
      break;
    }
  }

  // Supplement with static schedule for any slot not already covered by the RT feed.
  const rtTripIds = new Set(upcoming.map((b) => b.tripId));
  const nowSecs = dublinSecsSinceMidnight();
  const today = todayYYYYMMDD();
  const fmt = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  // Key: routeId + arrivalSecs — deduplicates calendar variants (weekday/weekend
  // trips that share the same route and scheduled time but have different trip IDs).
  const scheduledKeys = new Set(
    upcoming.filter((b) => !b.isScheduled).map((b) => `${b.routeId}:${b.scheduledTime}`)
  );

  for (const s of getScheduledArrivalsForStop(stopId, nowSecs)) {
    if (rtTripIds.has(s.tripId)) continue;
    const arrivalTimestamp = scheduledToUnix(s.arrivalSecs, today);
    if (arrivalTimestamp <= now) continue;
    const key = `${s.routeId}:${fmt(arrivalTimestamp)}`;
    if (scheduledKeys.has(key)) continue;
    scheduledKeys.add(key);
    upcoming.push({
      tripId: s.tripId,
      routeId: s.routeId,
      routeShortName: s.routeShortName,
      headsign: s.headsign,
      directionId: s.directionId,
      arrivalTimestamp,
      arrivalTime: fmt(arrivalTimestamp),
      scheduledTime: fmt(arrivalTimestamp),
      minutesAway: Math.max(0, Math.floor((arrivalTimestamp - now) / 60)),
      delaySeconds: 0,
      delayMinutes: 0,
      isStopping: true,
      occupancyStatus: null,
      historicalStopPct: null,
      stopId,
      isScheduled: true,
    });
  }

  upcoming.sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);
  return upcoming;
}

// Count of active trips per route short name, from the already-cached feed
// (no extra NTA calls). A trip counts as "running now" if it still has at least
// one stop-time update in the future. Returns { "74": 3, "15": 5, … }.
export async function getActiveCountsByRoute(): Promise<Record<string, number>> {
  const feed = await fetchFeed();
  const now = Math.floor(Date.now() / 1000);
  const counts: Record<string, number> = {};

  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;

    const trip = tu.trip;
    const routeId = trip?.routeId || trip?.tripId?.split("_")[0] || "";
    // RT routeId is like "1 74" or "1 15B c a" — second token is the short name.
    const shortName = routeId.split(" ")[1] || routeId;
    if (!shortName) continue;

    const tripId = trip?.tripId || entity.id;
    const startDate = (trip as any)?.startDate || todayYYYYMMDD();

    let active = false;
    for (const stu of tu.stopTimeUpdate ?? []) {
      const arrival = stu.arrival ?? stu.departure;
      const rtTime = Number(arrival?.time ?? 0);
      if (rtTime > 0) {
        if (rtTime > now) { active = true; break; }
        continue;
      }
      const arrivalSecs = stu.stopId ? getScheduledArrivalSecs(tripId, stu.stopId) : null;
      if (arrivalSecs !== null) {
        const eta = scheduledToUnix(arrivalSecs, startDate) + Number(arrival?.delay ?? 0);
        if (eta > now) { active = true; break; }
      }
    }

    if (active) counts[shortName] = (counts[shortName] ?? 0) + 1;
  }

  return counts;
}

export interface LiveTrip {
  tripId: string;
  routeShortName: string;
  headsign: string;
  directionId: number;
  nextStopId: string;
  nextStopName: string;
  arrivalTimestamp: number;
  minutesAway: number;
  delayMinutes: number;
}

// "Where are the <route> buses now?" — for each active trip on the route, find
// the next stop it is approaching (earliest stop-time update still in the
// future) with its ETA. Reuses the cached feed, so no extra NTA calls.
export async function getLiveTripsForRoute(routeShortName: string): Promise<LiveTrip[]> {
  const feed = await fetchFeed();
  const now = Math.floor(Date.now() / 1000);
  const target = routeShortName.trim().toUpperCase();
  const trips: LiveTrip[] = [];

  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;

    const trip = tu.trip;
    const routeId = trip?.routeId || trip?.tripId?.split("_")[0] || "";
    // RT routeId is like "1 74" or "1 15B c a" — second token is the short name
    const shortName = routeId.split(" ")[1] || routeId;
    if (shortName.toUpperCase() !== target) continue;

    const tripId = trip?.tripId || entity.id;
    const startDate = (trip as any)?.startDate || todayYYYYMMDD();
    const dirId = Number(trip?.directionId ?? 0);

    // Walk stop-time updates in order and take the first one still ahead of us.
    let next: { stopId: string; eta: number; delay: number } | null = null;
    for (const stu of tu.stopTimeUpdate ?? []) {
      const stopId = stu.stopId;
      if (!stopId) continue;
      const arrival = stu.arrival ?? stu.departure;
      const rtTime = Number(arrival?.time ?? 0);
      const delay = Number(arrival?.delay ?? 0);
      const arrivalSecs = getScheduledArrivalSecs(tripId, stopId);

      let eta: number;
      if (rtTime > 0) {
        eta = rtTime;
      } else if (arrivalSecs !== null) {
        eta = scheduledToUnix(arrivalSecs, startDate) + delay;
      } else {
        continue;
      }

      if (eta > now) {
        next = { stopId, eta, delay };
        break;
      }
    }

    if (!next) continue;

    trips.push({
      tripId,
      routeShortName: shortName,
      headsign: getHeadsignForRoute(shortName, dirId) ?? "",
      directionId: dirId,
      nextStopId: next.stopId,
      nextStopName: getStopName(next.stopId) ?? next.stopId,
      arrivalTimestamp: next.eta,
      minutesAway: Math.max(0, Math.floor((next.eta - now) / 60)),
      delayMinutes: Math.round(next.delay / 60),
    });
  }

  trips.sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);
  return trips;
}
