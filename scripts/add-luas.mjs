#!/usr/bin/env node
// Adds Luas (Red + Green lines) to the existing gtfs.db so trams appear in
// search / nearby / route views alongside buses.
//
// Data source: the official Luas API stop list
//   https://luasforecasts.rpa.ie/xml/get.ashx?action=list&encrypt=false
// This is the SAME service that powers the realtime forecasts, so the stop
// abbreviation we store here is guaranteed to match src/lib/luas.ts at runtime.
//
// Luas stop_ids are namespaced "LUAS_<ABBREV>" (e.g. LUAS_STS) to avoid any
// collision with bus stop_ids, and rows are tagged mode='luas'. A cache of the
// fetched mapping is written to scripts/luas-stop-codes.json.
//
// Usage: node scripts/add-luas.mjs   (no arguments — fetches from the Luas API)

import Database from 'better-sqlite3';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'gtfs.db');
const CACHE_PATH = path.join(__dirname, 'luas-stop-codes.json');
const LIST_URL = 'https://luasforecasts.rpa.ie/xml/get.ashx?action=list&encrypt=false';

// ---- 1. Obtain the Luas stop list (live, falling back to the cached JSON) ----

function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

// Returns [{ line: "Red"|"Green", abbrev, name, lat, lon }] in line order.
function parseList(xml) {
  const stops = [];
  for (const lineMatch of xml.matchAll(/<line\b([^>]*)>([\s\S]*?)<\/line>/g)) {
    const lineName = parseAttrs(lineMatch[1]).name || '';
    const line = /green/i.test(lineName) ? 'Green' : 'Red';
    for (const s of lineMatch[2].matchAll(/<stop\b([^>]*)>([^<]*)<\/stop>/g)) {
      const a = parseAttrs(s[1]);
      const abbrev = (a.abrev || a.abbrev || '').trim();
      const name = s[2].trim();
      if (!abbrev || !name) continue;
      stops.push({
        line,
        abbrev,
        name,
        lat: a.lat ? parseFloat(a.lat) : null,
        lon: a.long ? parseFloat(a.long) : null,
      });
    }
  }
  return stops;
}

async function loadStops() {
  try {
    const res = await fetch(LIST_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const stops = parseList(xml);
    if (stops.length === 0) throw new Error('parsed 0 stops');
    writeFileSync(CACHE_PATH, JSON.stringify(stops, null, 2));
    console.log(`Fetched ${stops.length} Luas stops from the Luas API (cached to ${path.basename(CACHE_PATH)})`);
    return stops;
  } catch (err) {
    if (existsSync(CACHE_PATH)) {
      console.warn(`Live fetch failed (${err.message}); using cached ${path.basename(CACHE_PATH)}`);
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    }
    console.error(`Could not fetch the Luas stop list and no cache exists: ${err.message}`);
    process.exit(1);
  }
}

// ---- 2. Prepare the database ------------------------------------------------

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create the shared tables if the bus import hasn't run yet, so Luas can work
// standalone. Schemas match scripts/import-gtfs.mjs / add-stops / add-routes.
db.exec(`
  CREATE TABLE IF NOT EXISTS stops (
    stop_id TEXT PRIMARY KEY, stop_name TEXT NOT NULL, stop_lat REAL, stop_lon REAL
  );
  CREATE TABLE IF NOT EXISTS routes (
    route_id TEXT PRIMARY KEY, route_short_name TEXT NOT NULL, route_long_name TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL, headsign TEXT NOT NULL DEFAULT '', direction_id INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS stop_times (
    trip_id TEXT NOT NULL, stop_id TEXT NOT NULL, arrival_secs INTEGER NOT NULL, stop_sequence INTEGER NOT NULL,
    PRIMARY KEY (trip_id, stop_sequence)
  );
  CREATE INDEX IF NOT EXISTS idx_stops_latlon ON stops(stop_lat, stop_lon);
  CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
  CREATE INDEX IF NOT EXISTS idx_trip_stop ON stop_times(trip_id, stop_id);
`);

// Add the discriminator columns if missing (idempotent).
function ensureColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${decl}`);
}
ensureColumn('stops', 'mode', "mode TEXT NOT NULL DEFAULT 'bus'");
ensureColumn('stops', 'abbrev', 'abbrev TEXT');
ensureColumn('routes', 'mode', "mode TEXT NOT NULL DEFAULT 'bus'");
ensureColumn('routes', 'route_type', 'route_type INTEGER');

// ---- 3. Insert Luas data ----------------------------------------------------

const stops = await loadStops();
const byLine = { Red: [], Green: [] };
for (const s of stops) (byLine[s.line] ??= []).push(s);

const upsertStop = db.prepare(
  `INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, mode, abbrev)
   VALUES (@stop_id, @stop_name, @lat, @lon, 'luas', @abbrev)
   ON CONFLICT(stop_id) DO UPDATE SET
     stop_name=excluded.stop_name, stop_lat=excluded.stop_lat,
     stop_lon=excluded.stop_lon, mode='luas', abbrev=excluded.abbrev`
);
const upsertRoute = db.prepare(
  `INSERT INTO routes (route_id, route_short_name, route_long_name, mode, route_type)
   VALUES (?, ?, ?, 'luas', 0)
   ON CONFLICT(route_id) DO UPDATE SET
     route_short_name=excluded.route_short_name, route_long_name=excluded.route_long_name,
     mode='luas', route_type=0`
);
const insertTrip = db.prepare(
  `INSERT INTO trips (trip_id, route_id, headsign, direction_id) VALUES (?, ?, ?, ?)
   ON CONFLICT(trip_id) DO UPDATE SET headsign=excluded.headsign, direction_id=excluded.direction_id`
);
const insertStopTime = db.prepare(
  `INSERT INTO stop_times (trip_id, stop_id, arrival_secs, stop_sequence) VALUES (?, ?, 0, ?)
   ON CONFLICT(trip_id, stop_sequence) DO UPDATE SET stop_id=excluded.stop_id`
);

const run = db.transaction(() => {
  for (const [line, lineStops] of Object.entries(byLine)) {
    if (lineStops.length === 0) continue;
    const routeId = `LUAS_${line.toUpperCase()}`;
    upsertRoute.run(routeId, line, `Luas ${line} Line`);

    for (const s of lineStops) {
      upsertStop.run({ stop_id: `LUAS_${s.abbrev}`, stop_name: s.name, lat: s.lat, lon: s.lon, abbrev: s.abbrev });
    }

    // Two synthetic trips (forward + reverse) give the route→stops ordering used
    // by the "Stops" tab. Times are unused for Luas — realtime comes from the
    // forecast API — so arrival_secs is 0.
    const forward = lineStops;
    const reverse = [...lineStops].reverse();
    for (const [dir, seq] of [[0, forward], [1, reverse]]) {
      const tripId = `${routeId}_${dir}`;
      const headsign = seq[seq.length - 1].name;
      insertTrip.run(tripId, routeId, headsign, dir);
      seq.forEach((s, i) => insertStopTime.run(tripId, `LUAS_${s.abbrev}`, i));
    }
  }
});
run();

const stopCount = db.prepare("SELECT COUNT(*) n FROM stops WHERE mode='luas'").get().n;
const routeCount = db.prepare("SELECT COUNT(*) n FROM routes WHERE mode='luas'").get().n;
db.close();
console.log(`Done — added ${routeCount} Luas routes and ${stopCount} Luas stops to gtfs.db`);
