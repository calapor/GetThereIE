import BetterSqlite3 from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

let db: BetterSqlite3.Database | null = null;

function getDb(): BetterSqlite3.Database | null {
  if (db !== null) return db;
  const dbPath = process.env.GTFS_DB_PATH ?? path.join(process.cwd(), "gtfs.db");
  if (!existsSync(dbPath)) return null;
  db = new BetterSqlite3(dbPath, { readonly: true });
  return db;
}

export function getScheduledArrivalSecs(
  tripId: string,
  stopId: string
): number | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare(
      "SELECT arrival_secs FROM stop_times WHERE trip_id = ? AND stop_id = ? LIMIT 1"
    )
    .get(tripId, stopId) as { arrival_secs: number } | undefined;
  return row?.arrival_secs ?? null;
}

export function getHeadsignForRoute(routeShortName: string, directionId: number): string | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare(
      `SELECT t.headsign
       FROM trips t JOIN routes r ON r.route_id = t.route_id
       WHERE r.route_short_name = ? AND t.direction_id = ? AND t.headsign != ''
       GROUP BY t.headsign ORDER BY COUNT(*) DESC LIMIT 1`
    )
    .get(routeShortName, directionId) as { headsign: string } | undefined;
  return row?.headsign ?? null;
}

export function getStopName(stopId: string): string | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare("SELECT stop_name FROM stops WHERE stop_id = ? LIMIT 1")
    .get(stopId) as { stop_name: string } | undefined;
  return row?.stop_name ?? null;
}

export interface StopResult {
  stop_id: string;
  stop_name: string;
  stop_lat: number | null;
  stop_lon: number | null;
}

export interface RouteResult {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
}

export interface NearbyStop extends StopResult {
  distanceMeters: number;
}

// Full-text stop search by name (Dublin Bus stops only), matching the existing
// /api/stops/search behaviour but also returning coordinates.
export function searchStops(q: string, limit = 20): StopResult[] {
  const d = getDb();
  if (!d || q.length < 2) return [];
  return d
    .prepare(
      `SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops
       WHERE stop_id LIKE '%DB%' AND stop_name LIKE ?
       ORDER BY stop_name ASC LIMIT ?`
    )
    .all(`%${q}%`, limit) as StopResult[];
}

// Route search by short name (prefix-prioritised) or long name.
export function searchRoutes(q: string, limit = 20): RouteResult[] {
  const d = getDb();
  if (!d || q.length < 1) return [];
  return d
    .prepare(
      `SELECT route_id, route_short_name, route_long_name
       FROM routes
       WHERE route_short_name LIKE ? OR route_long_name LIKE ?
       ORDER BY
         CASE WHEN route_short_name LIKE ? THEN 0 ELSE 1 END,
         route_short_name ASC
       LIMIT ?`
    )
    .all(`${q}%`, `%${q}%`, `${q}%`, limit) as RouteResult[];
}

// Distinct stops served by a route, optionally filtered by name and/or direction.
// Uses the longest trip per direction as the canonical stop ordering so stops
// appear in route sequence rather than alphabetically.
// direction = -1 means both directions.
export function getStopsForRoute(routeId: string, q = "", limit = 300, direction = -1): StopResult[] {
  const d = getDb();
  if (!d || !routeId) return [];
  return d
    .prepare(
      `WITH rep AS (
         SELECT t.trip_id, t.direction_id,
                ROW_NUMBER() OVER (
                  PARTITION BY t.direction_id
                  ORDER BY COUNT(st2.stop_id) DESC, t.trip_id
                ) AS rn
         FROM trips t
         JOIN stop_times st2 ON st2.trip_id = t.trip_id
         WHERE t.route_id = ?
         GROUP BY t.trip_id, t.direction_id
       )
       SELECT st.stop_id, s.stop_name, s.stop_lat, s.stop_lon
       FROM stop_times st
       JOIN stops s ON s.stop_id = st.stop_id
       JOIN rep ON rep.trip_id = st.trip_id AND rep.rn = 1
       WHERE (? = '' OR s.stop_name LIKE ?)
         AND (? = -1 OR rep.direction_id = ?)
       ORDER BY rep.direction_id, st.stop_sequence
       LIMIT ?`
    )
    .all(routeId, q, `%${q}%`, direction, direction, limit) as StopResult[];
}

export interface RouteDirection {
  directionId: number;
  headsign: string;
}

export interface ScheduledArrival {
  tripId: string;
  routeId: string;
  routeShortName: string;
  headsign: string;
  directionId: number;
  arrivalSecs: number;
}

// Returns upcoming scheduled arrivals at a stop from the static GTFS timetable.
// fromSecs is seconds-from-midnight in Dublin local time.
// windowSecs controls the lookahead window (default 90 min).
export function getScheduledArrivalsForStop(
  stopId: string,
  fromSecs: number,
  windowSecs = 5400
): ScheduledArrival[] {
  const d = getDb();
  if (!d) return [];
  return d
    .prepare(
      `SELECT st.trip_id      AS tripId,
              t.route_id      AS routeId,
              r.route_short_name AS routeShortName,
              t.headsign,
              t.direction_id  AS directionId,
              st.arrival_secs AS arrivalSecs
       FROM stop_times st
       JOIN trips t  ON t.trip_id  = st.trip_id
       JOIN routes r ON r.route_id = t.route_id
       WHERE st.stop_id = ?
         AND st.arrival_secs >= ?
         AND st.arrival_secs <  ?
       ORDER BY st.arrival_secs ASC
       LIMIT 20`
    )
    .all(stopId, fromSecs, fromSecs + windowSecs) as ScheduledArrival[];
}

// Returns the distinct directions for a route with their most common headsign.
export function getRouteDirections(routeId: string): RouteDirection[] {
  const d = getDb();
  if (!d || !routeId) return [];
  return d
    .prepare(
      `SELECT direction_id as directionId,
              (SELECT t2.headsign FROM trips t2
               WHERE t2.route_id = t.route_id AND t2.direction_id = t.direction_id
                 AND t2.headsign != ''
               GROUP BY t2.headsign ORDER BY COUNT(*) DESC LIMIT 1) as headsign
       FROM trips t
       WHERE t.route_id = ?
       GROUP BY t.direction_id
       ORDER BY t.direction_id`
    )
    .all(routeId) as RouteDirection[];
}

export function getStopCoords(stopId: string): { lat: number; lon: number } | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare("SELECT stop_lat, stop_lon FROM stops WHERE stop_id = ? LIMIT 1")
    .get(stopId) as { stop_lat: number | null; stop_lon: number | null } | undefined;
  if (!row || row.stop_lat == null || row.stop_lon == null) return null;
  return { lat: row.stop_lat, lon: row.stop_lon };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Nearest Dublin Bus stops to a point. Uses a bounding-box SQL prefilter, then
// sorts by exact haversine distance in JS (no reliance on SQL trig functions).
export function nearbyStops(lat: number, lon: number, limit = 20): NearbyStop[] {
  const d = getDb();
  if (!d) return [];
  const latDelta = 0.02; // ~2.2 km north/south
  const lonDelta = 0.02 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const rows = d
    .prepare(
      `SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops
       WHERE stop_id LIKE '%DB%'
         AND stop_lat BETWEEN ? AND ?
         AND stop_lon BETWEEN ? AND ?`
    )
    .all(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta) as StopResult[];

  return rows
    .filter((r) => r.stop_lat != null && r.stop_lon != null)
    .map((r) => ({
      ...r,
      distanceMeters: Math.round(haversineMeters(lat, lon, r.stop_lat!, r.stop_lon!)),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}
