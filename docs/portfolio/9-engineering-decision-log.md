# 9 — Engineering Decision Log

Key decisions, the alternatives weighed, and the trade-offs accepted.

## 1. SQLite (not Postgres) for the GTFS timetable

**Decision:** Store the static schedule in a read-only SQLite file queried with `better-sqlite3`.
**Why:** The timetable is large, read-only reference data that is rebuilt wholesale on a schedule. A
single indexed file gives fast, synchronous point-lookups with zero network hops and trivial
rebuild-and-swap semantics — ideal on a Pi cluster. Postgres would add a server to operate for no
functional gain.
**Trade-off:** No concurrent writers and no server-side spatial types; nearby search is done with a
bounding box plus haversine in JS instead of PostGIS.

## 2. Two databases with separate lifecycles

**Decision:** Keep mutable app state (`dev.db`, Prisma) separate from the read-only timetable (`gtfs.db`).
**Why:** They have opposite access patterns — one is transactional and migration-managed, the other
is bulk-rebuilt and swapped. Mixing them would force the timetable through Prisma migrations and
complicate the atomic refresh.
**Trade-off:** No cross-database joins; the app composes results in application code instead.

## 3. Prisma for the app DB, raw SQL for the timetable

**Decision:** Use Prisma (with the `better-sqlite3` adapter) only for `User`/`Report`; query `gtfs.db`
with hand-written SQL.
**Why:** Prisma's migrations and type-safety are valuable for the evolving write model. For the
timetable, raw parameterised SQL is faster and lets queries adapt at runtime to
partially-imported schemas (`hasTable`/`hasColumn` guards).
**Trade-off:** Two data-access styles in one codebase; the raw queries are not type-checked against
the schema.

## 4. Next.js route handlers (not a separate API service)

**Decision:** Serve the API from the same Next.js app via `/api` route handlers.
**Why:** One codebase, one deployable, shared TypeScript types between client and server, and no
CORS or cross-service auth. Appropriate for the project's scale.
**Trade-off:** API and UI scale together and share a runtime; they cannot be deployed independently.

## 5. Haversine in JS (not PostGIS / spatial SQL)

**Decision:** Prefilter nearby stops with a lat/lon bounding box in SQL, then rank by exact
`haversineMeters` in JavaScript.
**Why:** SQLite has no built-in trig/spatial functions. The bounding box uses the indexed columns to
cut candidates cheaply; exact distance on the small remainder is negligible and keeps the math pure
and unit-testable.
**Trade-off:** Not suitable for very large radii, and the box is a coarse approximation of a circle —
fine for "stops within walking distance."

## 6. Multi-tier feed caching with serve-stale-on-error

**Decision:** Cache the NTA feed in memory (25s) and on disk, and return stale data when a live fetch
fails.
**Why:** Many concurrent requests fall inside one polling window; caching collapses them to a single
upstream call and survives worker restarts. Serving stale on rate-limit/errors keeps the board alive.
**Trade-off:** Data can be up to ~25s old (acceptable for a minutes-scale board), and the disk cache
adds two files to manage.

## 7. Pure-function extraction for testability

**Decision:** Isolate time math (`time.ts`), the points rule (`points-core.ts`), and distance
(`haversineMeters`) as dependency-free functions.
**Why:** These are the highest-risk pieces of logic. Pure functions make them deterministically
unit-testable with no network or DB — satisfying a hard rule that the suite stays fast, hermetic, and
free to run in CI.
**Trade-off:** A little indirection (e.g. `points.ts` wraps `points-core.ts`).

## 8. Unify Luas into the bus data shape

**Decision:** Parse RPA Luas forecasts into the same `BusArrival` type as buses and tag stops/routes
with a `mode` discriminator.
**Why:** One rendering path for two very different upstreams; the arrivals API just branches on stop
mode. Search, nearby, and route views work for trams for free.
**Trade-off:** A slightly artificial fit (Luas has no real timetable, so synthetic trips and
`arrival_secs = 0` exist purely for ordering).

## 9. Rebuild-and-swap timetable refresh over incremental updates

**Decision:** A CronJob rebuilds `gtfs.db` from scratch and atomically renames it into place; the app
detects the inode change and reopens.
**Why:** GTFS feeds are published as full snapshots, and the NTA rotates trip-ID prefixes — a full
rebuild is simpler and more correct than reconciling deltas, and the atomic swap avoids partial-state
reads. Hot-reload by inode avoids a restart.
**Trade-off:** A full rebuild is expensive (30–60 min on a Pi) and requires transient extra disk for
the `.new` file.

## 10. Deploy to home k3s via Jenkins + buildah

**Decision:** Build images with buildah in-cluster and deploy with Helm to a Pi k3s cluster.
**Why:** Full ownership of the pipeline end to end, and a realistic constrained-hardware target that
forces genuine operability (heap caps, timeouts, single-writer strategy).
**Trade-off:** Slow builds/rollouts and the `vfs` storage driver's full-layer copies; the pipeline
carries explicit disk-cleanup and long timeouts to cope.

## 11. `Recreate` deployment strategy

**Decision:** Use `strategy: Recreate` for the web Deployment.
**Why:** SQLite is single-writer; a rolling update would briefly run two pods against one file.
Recreate guarantees the old pod is gone before the new one starts.
**Trade-off:** A short downtime window on each rollout — acceptable for this app.

## 12. Reserve, but do not build, AI predictions

**Decision:** Ship the reporting loop and reserve Fullness/Historical columns and `BusArrival` fields
now, but leave the prediction model unbuilt (documented in `docs/ai-predictions.md`).
**Why:** Collecting the report signal early means training data accumulates before the feature is
built, while keeping the shipped product honest — the columns render placeholders and the fields are
`null`.
**Trade-off:** Some inert scaffolding in the codebase and UI that only pays off if the feature is
built later.
