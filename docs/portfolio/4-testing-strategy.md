# 4 — Testing Strategy

## Philosophy

Unit tests cover **pure, deterministic logic only** — no network, no database, no filesystem. The
most error-prone parts of the app (time-zone math, the points bonus rule, distance calculation) were
deliberately factored into dependency-free functions precisely so they could be tested this way. I/O
and upstream feeds are left to be validated manually and in the running system, not mocked in unit
tests.

## What is tested

### `src/lib/time.test.ts` — date/time helpers

The riskiest code in the app. GTFS scheduled arrivals are seconds-from-local-midnight; converting
them to real timestamps is where subtle bugs hide. Tests cover:

- `scheduledToUnix` + `fmtTime` round-tripping a scheduled arrival back to `HH:MM`, including
  zero-padding of single-digit hours/minutes.
- `minutesUntil` flooring to whole minutes and never returning negative.
- `delayToMinutes` rounding behaviour, including negative delays (early buses).

### `src/lib/points-core.test.ts` — the majority-bonus rule

`computeBonus(votes, vote)` is the entire scoring rule extracted as a pure function. Tests cover:

- Base points only below the majority threshold (fewer than 3 votes).
- Bonus awarded when a vote matches the majority with ≥3 votes.
- No bonus when a vote is against the majority.
- Tie handling (an exact split resolves majority to `false`).

### `src/lib/gtfs-db.distance.test.ts` — haversine

`haversineMeters` is pure geometry, so it is unit-tested directly:

- Zero distance for identical points.
- A known Dublin distance (O'Connell Bridge → St Stephen's Green ≈ 900 m) falls within a tolerance band.

## What is deliberately not unit-tested, and why

| Area | Why not | How it is validated instead |
|------|---------|-----------------------------|
| `nta.ts` feed fetch/decode | Hits the NTA API and depends on live protobuf | Manual checks; the `/api/debug-feed` route inspects raw feed contents |
| `luas.ts` forecast fetch | Hits the RPA API | Manual checks against the live board |
| `gtfs-db.ts` SQL queries | Require a large populated `gtfs.db` | Run against the real imported database in dev |
| `points.ts` `awardPoints` | Writes to the database via Prisma | Covered indirectly — its pure core (`computeBonus`) is unit-tested |
| React components | UI/rendering | Out of scope for the current unit suite |

This keeps the suite **fast, hermetic, and free to run** — a hard requirement, since CI runs it on
every push and PR with no credentials or network access.

## Vitest setup

`vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default", ["junit", { outputFile: "test-results/junit.xml" }]],
  },
});
```

- **`node` environment** — no jsdom is needed for pure-logic tests.
- **JUnit reporter** writes `test-results/junit.xml` so CI can publish a rich test report.

Run locally with `pnpm test` (single run) or `pnpm test:watch`.

## CI integration

`.github/workflows/ci.yml` runs, in order, on every push to `main` and every PR:

1. `pnpm install --frozen-lockfile`
2. `pnpm exec prisma generate`
3. `pnpm run lint`
4. `pnpm run typecheck`
5. `pnpm test`
6. **Publish test report** via `dorny/test-reporter@v1` (step `name: Vitest`, reading the JUnit XML) —
   this is the check the README's Tests badge points at.
7. `pnpm run build`

A parallel `secret-scan` job runs **gitleaks** on the full history. The same lint/typecheck/test/build
gate is repeated in the Jenkins `Verify` stage before any image is built (see
[8 — Deployment & Operations](8-deployment-and-operations.md)).
