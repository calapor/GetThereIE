# 1 — Pre-Development Phase

Decisions made before writing feature code, and the reasoning behind them.

## Why GTFS-Realtime, not scraping

The NTA publishes an official GTFS-Realtime feed (`api.nationaltransport.ie/gtfsr/v2`) plus static
GTFS timetables via Transport for Ireland. Building on these instead of scraping a consumer app or
website means:

- **A stable, documented contract.** GTFS and GTFS-RT are open standards with well-defined message
  types (`TripUpdate`, `StopTimeUpdate`) and typed protobuf bindings (`gtfs-realtime-bindings`).
- **Legitimacy and rate limits we can reason about.** An API key raises the ceiling; without one the
  app falls back to the public feed.
- **No brittle HTML parsing** that breaks whenever a third party restyles a page.

Luas is the exception — it has no GTFS-RT feed, so the app uses the **official RPA Luas Forecasts
API** (`luasforecasts.rpa.ie`), the same source that drives the physical platform signs. That is
still a first-party source, just a different shape (XML rather than protobuf).

## Why SQLite for the static schedule

The static GTFS timetable is large — millions of `stop_times` rows once Dublin Bus and Go-Ahead are
combined. Options considered:

| Option | Verdict |
|--------|---------|
| Load GTFS CSV into memory per request | Rejected — far too large and slow to parse repeatedly |
| Ship a Postgres/PostGIS instance | Rejected — heavy operational overhead for read-only reference data on a Pi cluster |
| **Read-only SQLite (`better-sqlite3`)** | **Chosen** — a single file, indexed, embedded, zero network hops, trivially rebuildable |

The timetable is treated as an **immutable, rebuildable artifact**: import scripts produce a fresh
`gtfs.db`, the app opens it read-only, and a refresh job swaps the file atomically. `better-sqlite3`
is synchronous and fast for the small, indexed point-lookups the ETA join needs
(`WHERE trip_id = ? AND stop_id = ?`).

## Two databases, two lifecycles

A deliberate split rather than one store:

- **App DB (`dev.db`)** — mutable user state (`User`, `Report`), managed by **Prisma** with the
  `better-sqlite3` adapter and migrations. Small, write-path, transactional.
- **GTFS timetable (`gtfs.db`)** — read-only reference data, queried directly with raw SQL for speed
  and rebuilt wholesale on a schedule. Prisma would add no value here and would fight the
  rebuild-and-swap model.

See [9 — Engineering Decision Log](9-engineering-decision-log.md) for the trade-offs.

## Data-source selection summary

| Data | Source | Format | Cadence |
|------|--------|--------|---------|
| Bus realtime | NTA GTFS-RT `TripUpdates` | protobuf | polled, cached 25s |
| Bus/operator schedule | Transport for Ireland GTFS ZIPs (Dublin Bus, Go-Ahead) | CSV in ZIP | imported, refreshed weekly |
| Luas realtime | RPA Luas Forecasts API | XML | polled per stop, cached 20s |
| Luas stops/lines | RPA Luas stop-list API | XML | imported (cached to JSON) |

## Time zone: a first-class concern

GTFS scheduled arrivals are **seconds from local midnight**. Converting them to real timestamps
requires operating in `Europe/Dublin`. This drove two early decisions: run the production container
with `TZ=Europe/Dublin`, and isolate all date/time math into a **pure, dependency-free module**
(`src/lib/time.ts`) that can be unit-tested deterministically. This is the single most error-prone
area of the app, so it was designed to be testable from day one.
