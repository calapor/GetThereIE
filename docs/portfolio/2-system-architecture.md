# 2 — System Architecture

## Overview

GetThereIE is a single Next.js 16 App Router application. The browser talks only to the app's own
`/api` route handlers; those handlers call server-side library modules, which in turn read the two
SQLite databases and the two upstream realtime feeds.

See [`docs/diagrams/architecture.puml`](../diagrams/architecture.puml) for the rendered diagram.

```
Browser (React 19)
   │  fetch /api/*
   ▼
Next.js Route Handlers (src/app/api/**)
   │
   ├── src/lib/nta.ts      ── NTA GTFS-RT TripUpdates (protobuf, cached)
   ├── src/lib/luas.ts     ── RPA Luas Forecasts (XML, cached)
   ├── src/lib/gtfs-db.ts  ── gtfs.db (read-only SQLite: schedule)
   ├── src/lib/time.ts     ── pure date/time helpers
   └── src/lib/points.ts   ── dev.db (Prisma: User, Report)
```

## Request flow: a stop arrival board

`GET /api/buses/[stopId]` is the core path:

1. **Mode resolution.** `getStopInfo(stopId)` (gtfs-db) returns the stop's `mode` (`bus` or `luas`)
   and, for Luas, its forecast abbreviation.
2. **Luas branch.** If the stop is a tram stop, `getLuasForecastForStop(abbrev, line)` (luas.ts)
   fetches and parses the RPA XML into the shared `BusArrival` shape and returns.
3. **Bus branch.** Otherwise `getBusesForStop(stopId)` (nta.ts) runs the ETA join described below.
4. The handler returns `{ stopId, stopName, mode, fetchedAt, buses }`.

## The ETA computation (heart of the system)

`getBusesForStop` in `src/lib/nta.ts`:

1. **Fetch the feed** (`fetchFeed`) — see caching below.
2. **Walk every `TripUpdate` entity** and its `StopTimeUpdate`s, keeping those whose `stopId` matches.
3. For each match, resolve the ETA:
   - If the update carries an absolute realtime `arrival.time`, use it directly.
   - Otherwise look up the **scheduled arrival seconds** for `(tripId, stopId)` from `gtfs.db`
     (`getScheduledArrivalSecs`), convert to a Unix timestamp via `scheduledToUnix` (time.ts), and
     add the realtime `delay`.
4. Drop anything already in the past; compute `minutesAway`, `scheduledTime`, `arrivalTime`,
   `delayMinutes`, and the destination `headsign` (via `getHeadsignForRoute`).
5. **Supplement with the static schedule.** `getScheduledArrivalsForStop(stopId, nowSecs)` returns
   upcoming timetabled trips; any not already covered by the realtime feed are added as
   `isScheduled: true` rows, de-duplicated by `routeId + scheduled time` to avoid calendar-variant
   double-counting.
6. Sort by arrival timestamp and return.

Two companion functions reuse the same cached feed with no extra API calls:
`getActiveCountsByRoute` (live vehicle counts per route, shown in search) and
`getLiveTripsForRoute` (the "where are the buses now" view behind `/api/routes/live`).

## Caching & resilience

The NTA feed (`fetchFeed`) uses a three-tier strategy:

1. **In-process memory cache** (25s TTL) — the fast path within a worker's lifetime.
2. **On-disk cache** (`.feed-cache.bin` + `.json`) — survives Next.js worker restarts and hot
   reloads, so a redeploy or dev-server reload does not hammer the API.
3. **Live fetch**, gated by `NTA_API_KEY`. On rate-limit or transient error, the code **serves stale
   cached data** rather than throwing — the board degrades gracefully instead of blanking.

Luas forecasts use a simpler per-stop in-memory cache (20s TTL) with the same
serve-stale-on-failure behaviour.

## Database access

- **`gtfs.db`** is opened read-only in `src/lib/gtfs-db.ts`. The module tracks the file's **inode**
  and reopens the handle if the file is swapped underneath it (the weekly refresh writes a new file
  and renames it into place), so the app hot-reloads fresh timetable data without a restart. Schema
  presence is memoised (`hasTable`/`hasColumn`) and the cache is cleared on reopen, letting queries
  adapt to partially-imported databases.
- **`dev.db`** is accessed through a singleton Prisma client (`src/lib/db.ts`) using the
  `better-sqlite3` adapter, with the path configurable via `DATABASE_PATH`.

## Deployment topology

A single container image runs the standalone Next.js server. In the k3s cluster it mounts a
PersistentVolumeClaim at `/data` holding both SQLite files; an init container runs
`prisma migrate deploy`; and a weekly CronJob rebuilds `gtfs.db` on the same volume. The Deployment
uses the `Recreate` strategy to honour SQLite's single-writer constraint. Full detail in
[8 — Deployment & Operations](8-deployment-and-operations.md).
