# Architecture — Bus Tracker Ireland (GetThereIE)

## Dual database

The app uses two separate SQLite databases with distinct lifecycles:

| Database | File | Purpose | Owner |
|----------|------|---------|-------|
| App DB | `dev.db` (default) | Prisma-managed — `User` points, `Report` votes | `src/lib/db.ts` |
| GTFS timetable | `gtfs.db` | Static schedule — stops, routes, trips, stop_times, calendar | `src/lib/gtfs-db.ts` |

`DATABASE_PATH` and `GTFS_DB_PATH` env vars control the paths; in the cluster both land on a PVC at `/data/`.

**App DB** uses Prisma 7 with the `@prisma/adapter-better-sqlite3` adapter. Migrations run via an init container on every deploy (`prisma migrate deploy`). The `Recreate` deployment strategy enforces the single-writer SQLite constraint.

**GTFS timetable** is a read-only SQLite file queried directly with `better-sqlite3`. It is rebuilt weekly by a Kubernetes CronJob (`deploy/helm/bustracker/templates/gtfs-refresh-cronjob.yaml`) and hot-reloaded by the app on file change (`src/lib/gtfs-db.ts` watches the inode). The 807 MB timetable covers Dublin Bus, Go-Ahead Ireland, and Luas (~8.6M stop_time rows).

## Realtime feed

Two realtime sources feed the live board:

- **NTA GTFS-RT** (`src/lib/nta.ts`): protobuf-encoded `TripUpdate` messages from `api.nationaltransport.ie/gtfsr/v2`. The feed is cached in memory (25s TTL) and on disk (`.feed-cache.bin`) so every request within a polling window reuses the same payload without hitting the API. Uncached requests are gated by `NTA_API_KEY`.

- **Luas Forecasts** (`src/lib/luas.ts`): plain HTTP XML from `luasforecasts.rpa.ie`. Fetched per tram stop, parsed, and merged with GTFS-static Luas stops (tagged `mode='luas'`).

## ETA computation

`getBusesForStop` in `src/lib/nta.ts` joins each live trip-update to its scheduled arrival:

1. Look up the scheduled arrival for `(tripId, stopId)` from the GTFS DB (`getScheduledArrivalSecs`).
2. Convert scheduled seconds-from-midnight → Unix timestamp via `scheduledToUnix` (`src/lib/time.ts`).
3. Add the RT delay to get the ETA.
4. Supplement with static schedule entries for trips not yet in the RT feed (`getScheduledArrivalsForStop`).

Pure date/time helpers are isolated in `src/lib/time.ts` (dependency-free, fully unit-tested).

## Gamification

Users earn points by reporting bus status (on time / stopped / full) via `src/lib/points.ts`. The bonus rule is extracted as a pure function in `src/lib/points-core.ts`: 5 base points per report, +10 bonus when the user's vote matches the majority across ≥3 votes. Leaderboard data persists in the app DB.

## Deployment

```
git push → Jenkins (Jenkinsfile) → buildah image → private registry (192.168.1.101:30500)
                                 → helm upgrade  → k3s Pi cluster (bustracker namespace)
                                                 → Traefik ingress
```

- **Image**: ~600 MB (Next.js + pnpm prod deps + Prisma client + import scripts). No GTFS baked in.
- **PVC**: 4Gi, stores `dev.db` (tiny) and `gtfs.db` (807 MB). Refreshed by a weekly CronJob.
- **First deploy**: run the one-off seed job (`kubectl create job --from=cronjob/...gtfs-refresh gtfs-seed`) before the live board works.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) runs lint + typecheck + tests + build on every push/PR. The Jenkins pipeline handles the actual image build and cluster deploy on `main`.

See also: [README](../README.md) | [CONTRIBUTING](../CONTRIBUTING.md) | [docs/ai-predictions.md](./ai-predictions.md)
