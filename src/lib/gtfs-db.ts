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

// Origin/destination endpoints for a route, derived from the most common
// headsign in each direction. Inbound (dir 1) headsign ≈ origin, outbound
// (dir 0) headsign ≈ destination. Either may be null on one-directional routes.
export function getRouteEndpoints(routeShortName: string): { origin: string | null; destination: string | null } {
  return {
    origin: getHeadsignForRoute(routeShortName, 1),
    destination: getHeadsignForRoute(routeShortName, 0),
  };
}

// The route short name serving a stop (used to tag Luas arrivals with "Red"/
// "Green"). For Luas each stop belongs to exactly one line.
export function getLineForStop(stopId: string): string | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare(
      `SELECT r.route_short_name AS name
       FROM stop_times st
       JOIN trips t  ON t.trip_id = st.trip_id
       JOIN routes r ON r.route_id = t.route_id
       WHERE st.stop_id = ? LIMIT 1`
    )
    .get(stopId) as { name: string } | undefined;
  return row?.name ?? null;
}

// Ordered stops of a Luas line (direction 0), with the realtime abbreviation.
export function getLuasLineStops(shortName: string): { stop_id: string; stop_name: string; abbrev: string | null }[] {
  const d = getDb();
  if (!d || !hasColumn(d, "stops", "abbrev")) return [];
  return d
    .prepare(
      `SELECT s.stop_id, s.stop_name, s.abbrev
       FROM stop_times st
       JOIN stops s  ON s.stop_id = st.stop_id
       JOIN trips t  ON t.trip_id = st.trip_id
       JOIN routes r ON r.route_id = t.route_id
       WHERE r.route_short_name = ? AND t.direction_id = 0
       ORDER BY st.stop_sequence`
    )
    .all(shortName) as { stop_id: string; stop_name: string; abbrev: string | null }[];
}

export function getStopName(stopId: string): string | null {
  const d = getDb();
  if (!d) return null;
  const row = d
    .prepare("SELECT stop_name FROM stops WHERE stop_id = ? LIMIT 1")
    .get(stopId) as { stop_name: string } | undefined;
  return row?.stop_name ?? null;
}

export type Mode = "bus" | "luas";

export interface StopResult {
  stop_id: string;
  stop_name: string;
  stop_lat: number | null;
  stop_lon: number | null;
  mode?: Mode;
  abbrev?: string | null;
}

export interface RouteResult {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  mode?: Mode;
}

export interface NearbyStop extends StopResult {
  distanceMeters: number;
}

// Whether the Luas columns exist yet (added by scripts/add-luas.mjs). Memoised
// per column so bus-only databases (no Luas import) keep working unchanged.
const columnCache = new Map<string, boolean>();
function hasColumn(d: BetterSqlite3.Database, table: string, col: string): boolean {
  const key = `${table}.${col}`;
  const cached = columnCache.get(key);
  if (cached !== undefined) return cached;
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const exists = cols.some((c) => c.name === col);
  columnCache.set(key, exists);
  return exists;
}

// Full-text stop search by name. Includes Luas stops when present.
export function searchStops(q: string, limit = 20): StopResult[] {
  const d = getDb();
  if (!d || q.length < 2) return [];
  const withMode = hasColumn(d, "stops", "mode");
  const modeSel = withMode ? ", mode, abbrev" : "";
  const luasFilter = withMode ? " OR mode = 'luas'" : "";
  return d
    .prepare(
      `SELECT stop_id, stop_name, stop_lat, stop_lon${modeSel} FROM stops
       WHERE (stop_id LIKE '%DB%'${luasFilter}) AND stop_name LIKE ?
       ORDER BY stop_name ASC LIMIT ?`
    )
    .all(`%${q}%`, limit) as StopResult[];
}

// Route search by short name (prefix-prioritised) or long name.
export function searchRoutes(q: string, limit = 20): RouteResult[] {
  const d = getDb();
  if (!d || q.length < 1) return [];
  const modeSel = hasColumn(d, "routes", "mode") ? ", mode" : "";
  return d
    .prepare(
      `SELECT route_id, route_short_name, route_long_name${modeSel}
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

// Returns the set of service_ids active on a given date (YYYYMMDD) and day-of-week (0=Sun).
// Returns null if the calendar tables don't exist yet (pre-import).
function getActiveServiceIds(today: string, dayOfWeek: number): Set<string> | null {
  const d = getDb();
  if (!d) return null;
  const hasCalendar = d.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='calendar'").get();
  if (!hasCalendar) return null;

  const dayCol = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dayOfWeek];

  const base = (d.prepare(
    `SELECT service_id FROM calendar
     WHERE start_date <= ? AND end_date >= ? AND ${dayCol} = 1`
  ).all(today, today) as { service_id: string }[]).map(r => r.service_id);

  const added = (d.prepare(
    `SELECT service_id FROM calendar_dates WHERE date = ? AND exception_type = 1`
  ).all(today) as { service_id: string }[]).map(r => r.service_id);

  const removedRows = d.prepare(
    `SELECT service_id FROM calendar_dates WHERE date = ? AND exception_type = 2`
  ).all(today) as { service_id: string }[];
  const removed = new Set(removedRows.map(r => r.service_id));

  return new Set([...base, ...added].filter(id => !removed.has(id)));
}

// Returns 0=Sun, 1=Mon … 6=Sat in Dublin local time.
function dublinDayOfWeek(): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Dublin',
    weekday: 'long',
  }).format(new Date());
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(name);
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

  // Build today's YYYYMMDD string in Dublin time
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Dublin' })
    .format(new Date()).replace(/-/g, '');
  const activeIds = getActiveServiceIds(today, dublinDayOfWeek());

  if (activeIds !== null) {
    // Calendar tables exist — filter to today's services only
    if (activeIds.size === 0) return [];
    const ids = [...activeIds];
    const placeholders = ids.map(() => '?').join(',');
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
           AND t.service_id IN (${placeholders})
         ORDER BY st.arrival_secs ASC
         LIMIT 20`
      )
      .all(stopId, fromSecs, fromSecs + windowSecs, ...ids) as ScheduledArrival[];
  }

  // No calendar tables yet — fall back to unfiltered (original behaviour)
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

function irishNowSecs(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')!.value);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value);
  const s = parseInt(parts.find(p => p.type === 'second')!.value);
  return h * 3600 + m * 60 + s;
}

export interface ScheduledTrip {
  tripId: string;
  routeId: string;
  routeShortName: string;
  headsign: string;
  directionId: number;
  arrivalSecs: number;
}

export function getUpcomingScheduledTripsForStop(
  stopId: string,
  windowSecs = 7200
): ScheduledTrip[] {
  const d = getDb();
  if (!d) return [];
  const nowSecs = irishNowSecs();
  return d.prepare(`
    SELECT st.trip_id AS tripId, r.route_id AS routeId,
           r.route_short_name AS routeShortName, t.headsign,
           t.direction_id AS directionId, st.arrival_secs AS arrivalSecs
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE st.stop_id = ? AND st.arrival_secs >= ? AND st.arrival_secs < ?
    ORDER BY st.arrival_secs ASC LIMIT 50
  `).all(stopId, nowSecs, nowSecs + windowSecs) as ScheduledTrip[];
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

// Nearest bus + Luas stops to a point. Uses a bounding-box SQL prefilter, then
// sorts by exact haversine distance in JS (no reliance on SQL trig functions).
export function nearbyStops(lat: number, lon: number, limit = 20): NearbyStop[] {
  const d = getDb();
  if (!d) return [];
  const withMode = hasColumn(d, "stops", "mode");
  const modeSel = withMode ? ", mode, abbrev" : "";
  const luasFilter = withMode ? " OR mode = 'luas'" : "";
  const latDelta = 0.02; // ~2.2 km north/south
  const lonDelta = 0.02 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const rows = d
    .prepare(
      `SELECT stop_id, stop_name, stop_lat, stop_lon${modeSel} FROM stops
       WHERE (stop_id LIKE '%DB%'${luasFilter})
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

// Mode + realtime abbreviation for a stop, so the arrivals API can route Luas
// stops to the Luas forecast source instead of the NTA feed.
export function getStopInfo(stopId: string): { mode: Mode; abbrev: string | null; name: string | null } | null {
  const d = getDb();
  if (!d) return null;
  const withMode = hasColumn(d, "stops", "mode");
  const modeSel = withMode ? "mode, abbrev" : "'bus' AS mode, NULL AS abbrev";
  const row = d
    .prepare(`SELECT stop_name, ${modeSel} FROM stops WHERE stop_id = ? LIMIT 1`)
    .get(stopId) as { stop_name: string; mode: Mode; abbrev: string | null } | undefined;
  if (!row) return null;
  return { mode: row.mode ?? "bus", abbrev: row.abbrev ?? null, name: row.stop_name ?? null };
}
