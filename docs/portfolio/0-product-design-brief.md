# 0 — Product & Design Brief

## The problem

Getting reliable real-time transit information for Dublin is harder than it looks. The NTA publishes
a GTFS-Realtime feed, but it is not directly consumable as a "when is my bus coming" answer:

- For most stops the realtime feed carries **only a delay value** — not an absolute arrival time.
  A delay is meaningless without the scheduled arrival to add it to, which lives in a separate,
  large static timetable.
- The static timetable is a multi-file GTFS ZIP with millions of `stop_times` rows across several
  operators — too big to ship in an app bundle or query naively.
- Luas (the tram network) is **not in the NTA GTFS-RT feed at all**; it has its own forecasting API
  with a completely different shape.
- Trip identifiers in the realtime feed are periodically rotated by the NTA, so a schedule imported
  once and left alone silently stops matching live trips.

The product goal is a fast, mobile-first board that answers "what is coming to this stop, and is it
on time?" for both bus and tram, and that stays correct as the underlying data churns.

## What the app does

- **Search** for any Dublin Bus, Go-Ahead Ireland, or Luas route or stop from one combined box.
- **Live arrival board** per stop showing Scheduled vs Expected times, with a delay status computed
  by joining the realtime feed to the static schedule.
- **Static-schedule fallback** so a stop that has no live vehicles nearby still shows upcoming
  scheduled departures rather than a blank board.
- **"Live now" per route** — where each vehicle currently is and the next stop it is approaching.
- **Nearby stops** by GPS, ranked by exact walking distance.
- **Luas board** driven by the RPA Luas Forecasts API, merged into the same UI as buses.
- **Community reporting** — users vote thumbs up/down on whether a bus stopped and whether it was on
  time, earning points and a majority-agreement bonus.

## Scope boundaries

**In scope:** real-time arrivals, route/stop discovery, nearby search, Luas forecasts, a
lightweight gamified reporting loop, and a self-contained deployment to a home Kubernetes cluster.

**Explicitly out of scope (today):**

- **Journey planning / routing.** The app answers "what is coming here," not "how do I get from A to
  B." There is no path search.
- **AI/ML predictions.** The board reserves Fullness and Historical columns, and a design doc exists
  (`docs/ai-predictions.md`), but **no model code is implemented** — those columns render placeholders.
- **Vehicle occupancy.** The GTFS-RT `occupancyStatus` is mapped in the UI if present, but the NTA
  feed does not currently populate it, so fullness is effectively unavailable.
- **Persistent, production-grade accounts.** Username registration and the leaderboard endpoints
  currently serve in-memory / placeholder data; only the reporting-and-points write path persists to
  the app database. See [7 — Gamification & Reporting](7-gamification-and-reporting.md).

## Design priorities

1. **Correctness of ETAs** — the schedule join and Dublin-local-time handling are the heart of the
   product and the most-tested code.
2. **Resilience over freshness** — feeds are cached and stale data is served on transient upstream
   failures rather than blanking the board.
3. **Mobile-first** — a compact, single-column layout with a fixed bottom nav.
4. **Operability on modest hardware** — the whole thing runs on Raspberry Pi k3s nodes.
