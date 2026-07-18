# AI Predictions — Design Doc

> **Status: Planned — no model code exists yet.** This document describes the intended
> features, data sources, and integration points. The SQL schema sketches below are marked
> `PROPOSED` and have not been applied to the database.

## Feature A — "This bus may be late"

**Goal:** Surface a predicted delay confidence alongside the NTA realtime ETA, derived from
historical user reports rather than from the NTA feed (which often has no delay signal at all
for many stops).

### Training signal

`Report` rows in the app DB where `type = 'ON_TIME'` are the primary signal. Each row records
whether a user observed the bus running on time (`vote = true`) or late/not stopping (`vote = false`),
along with `stopId`, `routeId`, and `tripId`.

Aggregations needed:
- Reports grouped by `routeId + stopId + day-of-week + time-of-day bucket` give a historical
  on-time rate for that service at that time and place.
- Join GTFS context (scheduled arrival via `stop_times`, direction via `trips`) to build richer features.

### Model sketch

A simple logistic regression or gradient-boosted tree trained on:
- Historical on-time rate for (route, stop, day-of-week, hour)
- NTA current delay (if present)
- Time since last report at this stop
- Calendar — bank holiday, school term

Output: `predictedDelayMinutes` (float) and `delayConfidence` (0–1).

### Integration points

```
src/lib/nta.ts          getBusesForStop()       → add predictedDelay field to BusArrival
src/app/api/buses/      [stopId]/route.ts       → include predictedDelay in response
src/components/         BusRow.tsx              → formatHistorical() displays the signal
```

---

## Feature B — "This bus may be full"

**Goal:** Predict occupancy from weather, traffic, events, and historical fullness reports,
supplementing the mostly-absent NTA `occupancyStatus` field.

### Training signal

`Report` rows where `type = 'STOPPED'` and `vote = false` (bus passed without stopping, often
indicating a full bus) are the primary signal. Enrich with:

- **Weather**: temperature, precipitation, wind from a cached weather API (Met Éireann or Open-Meteo).
- **Traffic**: road delay index from a traffic API or the NTA delay feed itself.
- **Events / holidays**: public holiday flags, school term, large events near the terminus.

### Model sketch

A regression model predicting expected passengers per trip, bucketed into occupancy bands
(EMPTY / MANY_SEATS / FEW_SEATS / STANDING / FULL). Features include:
- Historical fullness rate for (route, stop, day-of-week, hour)
- Current weather (rain, temperature, wind)
- Traffic delay from the NTA RT feed (proxy for congestion)
- Is today a school day / bank holiday?

Output: `predictedOccupancy` (enum) and `occupancyConfidence` (0–1).

### Integration points

```
src/lib/nta.ts          getBusesForStop()       → add predictedOccupancy to BusArrival
src/lib/weather-traffic.ts   (new)              → cache weather + traffic data (like nta.ts)
src/app/api/buses/      [stopId]/route.ts       → include predictedOccupancy in response
src/components/         BusRow.tsx              → formatOccupancy() displays the signal
```

---

## Proposed schema sketch

```sql
-- PROPOSED — not yet applied to the database

-- Aggregated historical delay observations per service slot
CREATE TABLE delay_observations (
  route_id      TEXT    NOT NULL,
  stop_id       TEXT    NOT NULL,
  day_of_week   INTEGER NOT NULL,  -- 0=Mon .. 6=Sun
  hour_bucket   INTEGER NOT NULL,  -- hour of day in Dublin time
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count    INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL,
  PRIMARY KEY (route_id, stop_id, day_of_week, hour_bucket)
);

-- Running statistics for live ETA enrichment
CREATE TABLE arrival_statistics (
  route_id              TEXT    NOT NULL,
  stop_id               TEXT    NOT NULL,
  avg_delay_minutes     REAL,
  p90_delay_minutes     REAL,
  sample_count          INTEGER NOT NULL DEFAULT 0,
  last_updated          TEXT    NOT NULL,
  PRIMARY KEY (route_id, stop_id)
);

-- Historical fullness observations
CREATE TABLE fullness_statistics (
  route_id         TEXT    NOT NULL,
  stop_id          TEXT    NOT NULL,
  day_of_week      INTEGER NOT NULL,
  hour_bucket      INTEGER NOT NULL,
  full_count       INTEGER NOT NULL DEFAULT 0,
  total_count      INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT    NOT NULL,
  PRIMARY KEY (route_id, stop_id, day_of_week, hour_bucket)
);

-- Cached weather data (keyed by date + hour, refreshed hourly)
CREATE TABLE weather_cache (
  date_hour     TEXT PRIMARY KEY,  -- ISO e.g. '2026-07-18T09'
  temperature_c REAL,
  precipitation_mm REAL,
  wind_kmh      REAL,
  fetched_at    TEXT NOT NULL
);

-- Cached traffic delay index (refreshed every ~5 minutes)
CREATE TABLE traffic_cache (
  fetched_at    TEXT PRIMARY KEY,
  delay_index   REAL  -- 1.0 = normal, >1.5 = heavy congestion
);
```

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) | [README](../README.md)
