# 3 — Data Model Reference

The app has two databases: the **GTFS timetable** (`gtfs.db`, read-only, raw SQL) and the
**app database** (`dev.db`, Prisma-managed).

## GTFS timetable (`gtfs.db`)

Built by the import scripts in `scripts/`. Schemas are a pragmatic subset of GTFS — only the columns
the app queries are imported.

### `stop_times` — created by `import-gtfs.mjs`

```sql
CREATE TABLE stop_times (
  trip_id       TEXT    NOT NULL,
  stop_id       TEXT    NOT NULL,
  arrival_secs  INTEGER NOT NULL,   -- seconds from local midnight
  stop_sequence INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
);
CREATE INDEX idx_trip_stop ON stop_times(trip_id, stop_id);
```

`arrival_time` (`HH:MM:SS`) is normalised to `arrival_secs` at import time so no parsing happens on
the hot path. The `(trip_id, stop_id)` index backs the core ETA lookup. This is the largest table
(millions of rows across operators).

### `stops` — created by `add-stops.mjs` (extended by `add-operator.mjs` / `add-luas.mjs`)

```sql
CREATE TABLE stops (
  stop_id   TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL,
  stop_lat  REAL,
  stop_lon  REAL,
  mode      TEXT NOT NULL DEFAULT 'bus',  -- 'bus' | 'luas'
  abbrev    TEXT                          -- Luas forecast code, e.g. 'STS'
);
CREATE INDEX idx_stops_latlon ON stops(stop_lat, stop_lon);
```

`mode` discriminates bus vs tram stops so the arrivals API can route Luas stops to the RPA forecast
source. `abbrev` is the Luas-only realtime key. The lat/lon index backs the nearby bounding-box query.

### `routes` and `trips` — created by `add-routes.mjs`

```sql
CREATE TABLE routes (
  route_id         TEXT PRIMARY KEY,
  route_short_name TEXT NOT NULL,
  route_long_name  TEXT NOT NULL DEFAULT '',
  mode             TEXT NOT NULL DEFAULT 'bus'   -- added by add-operator/add-luas
);

CREATE TABLE trips (
  trip_id      TEXT PRIMARY KEY,
  route_id     TEXT NOT NULL,
  headsign     TEXT NOT NULL DEFAULT '',
  direction_id INTEGER NOT NULL DEFAULT 0,
  service_id   TEXT NOT NULL DEFAULT ''          -- added by add-calendar.mjs
);
CREATE INDEX idx_trips_route ON trips(route_id);
```

### `calendar` and `calendar_dates` — created by `add-calendar.mjs`

```sql
CREATE TABLE calendar (
  service_id TEXT PRIMARY KEY,
  monday INTEGER, tuesday INTEGER, wednesday INTEGER, thursday INTEGER,
  friday INTEGER, saturday INTEGER, sunday INTEGER,   -- 0/1 flags
  start_date TEXT NOT NULL, end_date TEXT NOT NULL     -- YYYYMMDD
);

CREATE TABLE calendar_dates (
  service_id     TEXT NOT NULL,
  date           TEXT NOT NULL,      -- YYYYMMDD
  exception_type INTEGER NOT NULL,   -- 1 = added, 2 = removed
  PRIMARY KEY (service_id, date)
);
```

These drive **service-calendar filtering**: `getActiveServiceIds(today, dayOfWeek)` in `gtfs-db.ts`
computes which `service_id`s run on a given Dublin date (base weekly pattern + `calendar_dates`
exceptions), so the static-schedule fallback only shows trips that actually operate today. The code
degrades gracefully to unfiltered results if the calendar tables are absent (pre-import).

### Luas modelling note

Luas has no real timetable in this system. `add-luas.mjs` inserts each line as a route with two
**synthetic trips** (forward/reverse) purely to give the "Stops" tab an ordering; `stop_times`
rows use `arrival_secs = 0` because live tram times come from the RPA forecast API, not the schedule.

## App database (`dev.db`) — Prisma

`prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  points    Int      @default(0)
  createdAt DateTime @default(now())
  reports   Report[]
}

model Report {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  stopId    String
  routeId   String
  tripId    String
  type      String   // "ON_TIME" | "STOPPED"
  vote      Boolean  // thumbs up / down
  createdAt DateTime @default(now())

  @@unique([userId, tripId, type])
}
```

The `@@unique([userId, tripId, type])` constraint enforces **one vote per user per trip per report
type** — the deduplication that prevents point farming. See
[7 — Gamification & Reporting](7-gamification-and-reporting.md).

## Key TypeScript types

Defined in `src/lib/nta.ts` and `src/lib/gtfs-db.ts`:

- **`BusArrival`** — the unified board row used by both bus and Luas paths: `tripId`, `routeShortName`,
  `headsign`, `directionId`, `arrivalTimestamp`, `arrivalTime`, `scheduledTime`, `minutesAway`,
  `delaySeconds`/`delayMinutes`, `isStopping`, `occupancyStatus`, `historicalStopPct`, `isScheduled`.
  The last two are reserved for the (unimplemented) prediction features and are currently always `null`.
- **`LiveTrip`** — a vehicle on a route with its next stop and ETA (`/api/routes/live`).
- **`StopResult` / `RouteResult` / `NearbyStop`** — search and nearby query results;
  `NearbyStop` adds `distanceMeters`.
- **`ScheduledArrival`** — a timetabled arrival used by the static-schedule fallback.
