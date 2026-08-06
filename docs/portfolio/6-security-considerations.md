# 6 — Security Considerations

## Data classification

| Data | Sensitivity | Notes |
|------|-------------|-------|
| GTFS static timetable | Public | Open data published by Transport for Ireland |
| NTA GTFS-RT feed | Public | Open feed; a key raises rate limits but the data itself is public |
| Luas forecasts | Public | Same source as physical platform signs |
| Usernames | Low | Chosen handles, not real names or emails |
| Reports & points | Low | Anonymous transit observations tied to a username |

The app collects **no personal data beyond a chosen username** and stores no emails, passwords, or
location history. GPS coordinates for "nearby stops" are used transiently in a request and never
persisted.

## Secrets handling

The repository contains **no secrets** (documented in `SECURITY.md`). The only credential is
`NTA_API_KEY`, and it is supplied at runtime, never committed:

- **Local dev:** a git-ignored `.env.local` (all `.env*` files are git-ignored).
- **Cluster:** a Kubernetes Secret rendered by `deploy/helm/bustracker/templates/secret.yaml`, whose
  value is injected by the Jenkins pipeline from the `nta-api-key` credential
  (`--set ntaApiKey=...`) and mounted into the web pod and the refresh CronJob via `secretKeyRef`.
- **Fail-open by design:** if the key is unset the app falls back to the public NTA feed rather than
  breaking — a missing secret degrades service, it does not crash it.

**gitleaks** runs as a dedicated CI job on every push (full history, `fetch-depth: 0`) to catch any
accidental secret commit before it lands.

## Attack surface of the API

All endpoints are unauthenticated `GET`s except `POST /api/report` and `POST /api/user`. Read
endpoints only expose already-public transit data. The write endpoints are the interesting surface.

### `POST /api/report` — the reporting/points system

Because reports award points, this is the most abusable endpoint. Current controls:

- **Input validation:** required fields are checked and `type` is constrained to `ON_TIME` or
  `STOPPED`; anything else is a 400.
- **One vote per user/trip/type:** the `@@unique([userId, tripId, type])` constraint on `Report`
  means a repeat vote hits the unique constraint, awards **zero** points, and returns the user's
  existing total. This is the primary anti-farming control.

### Known abuse considerations (honest assessment)

- **No server-side identity.** `userId` is supplied by the client and is not authenticated. A
  determined actor could mint user IDs and cast one vote each, inflating a report's vote count and
  swinging the majority bonus. There is no rate limiting.
- **Report integrity.** Votes are self-reported observations with no corroboration against the
  realtime feed, so the community signal is only as trustworthy as its contributors. This matters
  most because these reports are the intended training signal for the (unbuilt) prediction features —
  poisoned reports would poison any future model.
- **Placeholder auth surfaces.** `POST /api/user` and `GET /api/leaderboard` currently return
  in-memory / placeholder data and are not a real identity or ranking system; they should not be
  relied on for anything security-sensitive. See [7 — Gamification & Reporting](7-gamification-and-reporting.md).

These are acceptable for a portfolio project with a low-value scoreboard; a production version would
add authenticated sessions, per-IP rate limiting, and server-derived user identity before treating
reports as trustworthy.

## Platform hardening

- The production image runs the standalone Next.js server with production-only dependencies
  (flat, hoisted `node_modules`); build tooling and dev dependencies are dropped from the runner stage.
- `/api/debug-feed` is a diagnostic endpoint that dumps raw feed structure — useful in dev, and worth
  removing or gating in a hardened production deployment.
- Kubernetes liveness/readiness probes hit `/api/healthz`, which returns no sensitive information.
