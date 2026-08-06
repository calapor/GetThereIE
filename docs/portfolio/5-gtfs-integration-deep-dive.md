# 5 — GTFS Integration Deep Dive

This is the technically hardest part of the app: turning two very different upstream feeds and a
large static timetable into a single, correct arrival board.

## Decoding GTFS-Realtime protobuf

The NTA feed at `api.nationaltransport.ie/gtfsr/v2/TripUpdates` is a protobuf-encoded
`FeedMessage`. Decoding uses the standard bindings:

```ts
import { transit_realtime } from "gtfs-realtime-bindings";
const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
```

Each `entity` may carry a `tripUpdate` with a `trip` (route, direction, trip ID, start date) and a
list of `stopTimeUpdate`s. Each stop-time update has an optional `arrival`/`departure` with `time`
and/or `delay`, and a `scheduleRelationship` (which the app checks for `SKIPPED`).

### The central problem: delay-only updates

For most stops the feed provides **only a `delay`, not an absolute `arrival.time`**. A delay on its
own cannot be rendered — you need the scheduled arrival to add it to. So the realtime feed is not
self-sufficient; it must be joined to the static timetable.

## Joining realtime to the static schedule

Per matched stop-time update (`getBusesForStop` in `src/lib/nta.ts`):

```
tripId      = tripUpdate.trip.tripId
startDate   = tripUpdate.trip.startDate  (or today, YYYYMMDD)
arrivalSecs = getScheduledArrivalSecs(tripId, stopId)   // from gtfs.db

if realtime arrival.time present:
    eta          = arrival.time
    scheduledUnix = scheduledToUnix(arrivalSecs, startDate)  // or eta - delay
else:
    if arrivalSecs is null: skip     // no schedule => cannot compute
    scheduledUnix = scheduledToUnix(arrivalSecs, startDate)
    eta          = scheduledUnix + delay
```

`scheduledToUnix` (in the pure `time.ts` module) turns *seconds-from-local-midnight* + a *YYYYMMDD
start date* into a Unix timestamp, relying on the process running in `Europe/Dublin`. This is why
the production container sets `TZ=Europe/Dublin` and why this function is the most heavily
unit-tested code in the repo.

### Route short name extraction

The realtime `routeId` is an internal string like `"1 74"` or `"1 15B c a"`. The **route short name
riders recognise is the second whitespace-delimited token**, so the code does `routeId.split(" ")[1]`
throughout. The headsign is then looked up from the static `trips`/`routes` tables via
`getHeadsignForRoute(shortName, directionId)`, which picks the most common headsign for that
route+direction.

## Static-schedule fallback

A stop with no nearby live vehicles would otherwise show an empty board. After processing the
realtime feed, `getScheduledArrivalsForStop(stopId, nowSecs)` pulls upcoming timetabled arrivals
straight from `gtfs.db`, filtered to **today's active services** via the calendar tables. Trips
already represented in the realtime results are skipped, and remaining ones are de-duplicated by
`routeId + scheduled time` (to collapse weekday/weekend calendar variants that share a time but have
different trip IDs) and marked `isScheduled: true` so the UI renders them differently (no live delay).

## The trip-ID prefix rotation problem

**This is the operational gotcha that makes fresh static data non-negotiable.** The NTA periodically
rotates the trip-ID prefixes used in both the static GTFS and the realtime feed. The ETA join keys
on an exact `(trip_id, stop_id)` match between the live feed and `gtfs.db`. If the imported schedule
is stale:

- Live trip IDs no longer match any `stop_times` row.
- `getScheduledArrivalSecs` returns `null` for delay-only updates.
- Those arrivals are silently dropped — **the board shows nothing, with no error**.

Mitigations:

- A **weekly CronJob** rebuilds `gtfs.db` from the latest feeds and swaps it in atomically.
- `gtfs-db.ts` watches the file **inode** and reopens the handle when the file is replaced, so the
  refresh takes effect without an app restart.
- The README and architecture docs flag "reimport when ETAs break" prominently for local dev.

## Luas: a separate world

Luas is absent from GTFS-RT entirely, so it uses the RPA Luas Forecasts API (`src/lib/luas.ts`):

- **Realtime:** per-stop XML from `luasforecasts.rpa.ie`, keyed by the stop's `abbrev`. A hand-rolled
  regex parser extracts `<direction>`/`<tram>` elements (destination, `dueMins`) and maps them into
  the **same `BusArrival` shape** as buses, so the UI is unified. "Due" maps to 0 minutes.
- **Static:** `add-luas.mjs` fetches the official Luas stop list, namespaces stop IDs as
  `LUAS_<ABBREV>`, tags rows `mode='luas'`, and creates synthetic forward/reverse trips for ordering.
  Because the same RPA service supplies both the stop list and the forecasts, the stored `abbrev` is
  guaranteed to match at runtime.
- **Line overview** (`getLuasLineOverview`) deliberately fans out to only the two termini (bounded,
  cached) rather than every stop, keeping it lighter than the bus vehicle feed.

## Import pipeline

`scripts/refresh-gtfs.mjs` orchestrates the full rebuild: download Dublin Bus + Go-Ahead ZIPs, then
run `import-gtfs → add-stops → add-routes → add-calendar → add-operator → add-luas`, cleaning up
temp files at the end. Each script streams CSV out of the ZIP with `unzip -p` piped through
`readline`, batching inserts in `better-sqlite3` transactions (10k rows) to import millions of rows
without loading everything into memory.
