# Bus Tracker Ireland (GetThereIE)

[![CI](https://github.com/calapor/GetThereIE/actions/workflows/ci.yml/badge.svg)](https://github.com/calapor/GetThereIE/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/github/checks-status/calapor/GetThereIE/main?check=Vitest&label=tests&logo=vitest)](https://github.com/calapor/GetThereIE/actions/workflows/ci.yml)

A Next.js app for live Dublin Bus and Luas tracking, built on the NTA GTFS-Realtime feed plus a
local static GTFS schedule. Users can search by route or stop, browse nearby stops, see live ETAs,
and earn points by reporting bus status — building a community-sourced picture of whether buses are
running on time and how full they are.

## Features

- **Route & stop search** — find any Dublin Bus, Go-Ahead Ireland, or Luas stop by name or number
- **Live arrival board** — real-time ETAs computed from the NTA GTFS-RT protobuf feed
- **Nearby stops** — GPS-based discovery using the haversine formula against the GTFS stops table
- **Luas board** — Red and Green line forecasts from the RPA Luas Forecasts API
- **Gamified reporting** — report on-time / stopped / full; earn points and climb the leaderboard

## Tech stack

Next.js 16 · React 19 · TypeScript · Prisma 7 + better-sqlite3 · Tailwind CSS 4 · Vitest

## Getting started

Requires Node 22, pnpm 11.1.1, and a populated `gtfs.db` (see [Static GTFS data](#static-gtfs-data)).

```bash
corepack enable && corepack prepare pnpm@11.1.1 --activate
pnpm install
cp .env.example .env.local   # optionally add your NTA_API_KEY
pnpm dev
```

Open [http://localhost:3005](http://localhost:3005).

### Environment

Copy `.env.example` to `.env.local`. The only required key for local dev is `NTA_API_KEY` — without
it the app falls back to the public (rate-limited) NTA feed. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Static GTFS data

Live ETAs are computed by joining a realtime trip to its scheduled arrival in a local SQLite
database (`gtfs.db`). The NTA realtime feed sends only a delay for most stops, so
**the static schedule must be present and current** — without it no ETA can be produced.

> **Keep the static data fresh.** The NTA rotates trip-ID prefixes periodically. If the
> imported schedule is stale, live trip IDs no longer match and the board silently shows nothing.
> In production the weekly CronJob handles this automatically; locally, reimport when ETAs break.

### Importing

Download the current per-operator zip and run the import pipeline (order matters):

```bash
curl -sL https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip -o /tmp/GTFS_DB.zip

node scripts/import-gtfs.mjs /tmp/GTFS_DB.zip   # stop_times (~2.4M rows)
node scripts/add-stops.mjs   /tmp/GTFS_DB.zip   # stops table with lat/lon
node scripts/add-routes.mjs  /tmp/GTFS_DB.zip   # routes + trips tables
node scripts/add-calendar.mjs /tmp/GTFS_DB.zip  # service calendar
```

Additional operators (e.g. Go-Ahead Ireland):

```bash
node scripts/add-operator.mjs /tmp/GTFS_GoAhead.zip
```

`gtfs.db` is git-ignored — it is never committed.

### Luas

Luas is not in the NTA GTFS-RT feed. It uses the RPA Forecasting API for realtime and a
self-contained static import for stops and lines:

```bash
node scripts/add-luas.mjs   # no zip needed — fetches the Luas stop list live
```

## Testing

```bash
pnpm test          # Vitest unit tests — pure functions, no network/DB
pnpm run typecheck # TypeScript type check
pnpm run lint      # ESLint
```

Unit tests cover the pure date/time helpers (`src/lib/time.ts`), the points bonus rule
(`src/lib/points-core.ts`), and the haversine distance function (`src/lib/gtfs-db.ts`).
All tests run without network access or a database.

## Deployment

The app deploys to a home k3s cluster (Raspberry Pi nodes) via Jenkins CI:

```
git push main → Jenkins → buildah image → private registry → helm upgrade (bustracker namespace)
```

The Helm chart lives in `deploy/helm/bustracker`. After the **first** deploy, seed the GTFS
timetable with the one-off job:

```bash
kubectl -n bustracker create job --from=cronjob/bustracker-gtfs-refresh gtfs-seed
```

The board shows an empty timetable until this completes (~30–60 min on a Pi). After that, a
weekly CronJob keeps the data current automatically.

GitHub Actions CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, and a production build on
every push and pull request. The Jenkins pipeline handles the actual image push and cluster deploy
on `main` only.

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — database design, realtime feed, ETA computation, deployment topology
- [docs/ai-predictions.md](./docs/ai-predictions.md) — planned AI prediction features (late/full bus)
- [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup and PR workflow
- [SECURITY.md](./SECURITY.md) — vulnerability reporting and secrets policy

## API endpoints

| Endpoint | Query params | Returns |
|---|---|---|
| `GET /api/search` | `q` | Combined route + stop search results |
| `GET /api/routes/search` | `q` | Matching routes (id, short/long name) |
| `GET /api/routes/stops` | `routeId`, optional `q` | Ordered stops for a route, with coordinates |
| `GET /api/routes/live` | `route` | Live trips for a route: next stop, `minutesAway`, `delayMinutes`, headsign, direction |
| `GET /api/stops/search` | `q` | Matching stops |
| `GET /api/stops/nearby` | `lat`, `lon` | Nearest stops with `distanceMeters` |
| `GET /api/buses/[stopId]` | — | Live arrivals for a single stop |

## Roadmap / AI

Planned ML features — "this bus may be late" and "this bus may be full" — are documented in
[docs/ai-predictions.md](./docs/ai-predictions.md). No model code exists yet; the plan covers
data sources, training signals, and integration points.

## License

[MIT](./LICENSE) © 2026 Richard O'Connor
