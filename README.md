# Bus Tracker Ireland

A Next.js app for live Dublin Bus tracking, built on the NTA GTFS-Realtime feed plus a
local static GTFS schedule. You can search by route or stop, browse nearby stops, and see
live arrival ETAs computed from the realtime feed.

## Getting Started

Requires Node.js and a populated `gtfs.db` (see [Static GTFS data](#static-gtfs-data)).

```bash
npm install
npm run dev
```

Open [http://localhost:3005](http://localhost:3005).

### Environment

Set `NTA_API_KEY` in `.env.local` — a subscription key for the NTA GTFS-R API
(`https://api.nationaltransport.ie/gtfsr/v2`). The realtime feed is cached server-side in
`src/lib/nta.ts` (~30s) to avoid rate limits, so don't fetch it per request.

## Static GTFS data

Live ETAs are computed by joining a live trip to its scheduled arrival in a local SQLite
database (`gtfs.db`). The Dublin Bus realtime feed sends only a `delay` for most stops, so
**the static schedule must be present and current** — without it, no ETA can be produced.

> ⚠️ **Keep the static data fresh.** The NTA rotates trip-ID prefixes periodically
> (e.g. `5242_*` → `5722_*`). If the imported schedule is stale, live trip IDs no longer
> match and the live board silently shows nothing. Reimport a current feed when this happens.

### Importing

Download the current per-operator zip and run the import pipeline (order matters — the
first step recreates `gtfs.db`):

```bash
curl -sL https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip -o /tmp/GTFS_DB.zip

node scripts/import-gtfs.mjs /tmp/GTFS_DB.zip   # builds stop_times (~2.4M rows)
node scripts/add-stops.mjs   /tmp/GTFS_DB.zip   # stops table incl. lat/lon
node scripts/add-routes.mjs  /tmp/GTFS_DB.zip   # routes + trips tables
```

Use the per-operator `GTFS_Dublin_Bus.zip` (~30MB) rather than the all-operators
`GTFS_All.zip` — the latter produces a much larger database.

Additional operators can be layered in with `node scripts/add-operator.mjs <zip>`.

`gtfs.db` is generated and git-ignored — it is not committed.

### Luas (Red + Green lines)

Luas is not in the NTA GTFS-R feed, so it uses the official RPA forecasting API
for realtime and a small self-contained static import for stops/lines:

```bash
node scripts/add-luas.mjs   # no zip needed — fetches the Luas stop list live
```

This adds ~67 tram stops and the Red/Green lines to `gtfs.db`, tagged
`mode = 'luas'` with the realtime abbreviation (`abbrev`) each stop uses on the
Luas Forecast API. It also creates the `mode`/`abbrev`/`route_type` columns if
they don't already exist, so it can run before or after the bus import (and even
on its own — Luas works with no NTA key). Realtime lives in `src/lib/luas.ts`;
the fetched mapping is cached to `scripts/luas-stop-codes.json`.

## API endpoints

| Endpoint | Query params | Returns |
| --- | --- | --- |
| `GET /api/search` | `q` | Combined route + stop search results |
| `GET /api/routes/search` | `q` | Matching routes (id, short/long name) |
| `GET /api/routes/stops` | `routeId`, optional `q` | Ordered stops for a route, with coordinates |
| `GET /api/routes/live` | `route` | Live trips for a route: next stop, `minutesAway`, `delayMinutes`, headsign, direction |
| `GET /api/stops/search` | `q` | Matching stops |
| `GET /api/stops/nearby` | `lat`, `lon` | Nearest stops with `distanceMeters` |
| `GET /api/buses/[stopId]` | — | Live arrivals for a single stop |

## Project layout

- `src/lib/nta.ts` — NTA realtime feed fetch/cache and `getLiveTripsForRoute`
- `src/lib/gtfs-db.ts` — SQLite query helpers (scheduled arrivals, stops, routes, nearby)
- `src/components/SearchFilter.tsx` — route/stop search + filter UI
- `src/components/StopBusBoard.tsx` — per-stop live board
- `scripts/*.mjs` — GTFS import pipeline
