#!/usr/bin/env node
// Appends stops + stop_times + routes + trips from an additional operator GTFS zip.
// Usage: node scripts/add-operator.mjs <path-to-GTFS_GoAhead.zip>
import Database from 'better-sqlite3';
import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_ZIP = process.argv[2];

if (!GTFS_ZIP) {
  console.error('Usage: node scripts/add-operator.mjs <path-to-GTFS_Operator.zip>');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'gtfs.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Ensure all tables exist (schemas match the primary import pipeline)
db.exec(`
  CREATE TABLE IF NOT EXISTS stops (
    stop_id   TEXT PRIMARY KEY,
    stop_name TEXT NOT NULL,
    stop_lat  REAL,
    stop_lon  REAL,
    mode      TEXT NOT NULL DEFAULT 'bus',
    abbrev    TEXT
  );
  CREATE TABLE IF NOT EXISTS stop_times (
    trip_id       TEXT    NOT NULL,
    stop_id       TEXT    NOT NULL,
    arrival_secs  INTEGER NOT NULL,
    stop_sequence INTEGER NOT NULL,
    PRIMARY KEY (trip_id, stop_sequence)
  );
  CREATE INDEX IF NOT EXISTS idx_trip_stop ON stop_times(trip_id, stop_id);
  CREATE TABLE IF NOT EXISTS routes (
    route_id         TEXT PRIMARY KEY,
    route_short_name TEXT NOT NULL,
    route_long_name  TEXT NOT NULL DEFAULT '',
    mode             TEXT NOT NULL DEFAULT 'bus'
  );
  CREATE TABLE IF NOT EXISTS trips (
    trip_id      TEXT PRIMARY KEY,
    route_id     TEXT NOT NULL,
    headsign     TEXT NOT NULL DEFAULT '',
    direction_id INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
`);

// Add columns that may be missing from older DBs
function ensureColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${decl}`);
}
ensureColumn('stops', 'stop_lat', 'stop_lat REAL');
ensureColumn('stops', 'stop_lon', 'stop_lon REAL');
ensureColumn('stops', 'mode', "mode TEXT NOT NULL DEFAULT 'bus'");
ensureColumn('stops', 'abbrev', 'abbrev TEXT');
ensureColumn('routes', 'mode', "mode TEXT NOT NULL DEFAULT 'bus'");

function timeToSecs(t) {
  const [h, m, s] = t.split(':');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
}

function streamCsv(filename, onRow) {
  return new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-p', GTFS_ZIP, filename]);
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    let header = null;
    let count = 0;
    rl.on('line', (line) => {
      if (!line) return;
      if (!header) { header = line.split(','); return; }
      const fields = line.split(',');
      const row = {};
      header.forEach((col, i) => { row[col] = fields[i] ?? ''; });
      onRow(row);
      count++;
    });
    rl.on('close', () => { console.log(`  ${count.toLocaleString()} rows`); resolve(); });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', reject);
  });
}

// --- stops ---
console.log('Importing stops.txt...');
const insertStop = db.prepare(
  'INSERT OR IGNORE INTO stops (stop_id, stop_name, stop_lat, stop_lon) VALUES (?, ?, ?, ?)'
);
const insertStopsBatch = db.transaction((rows) => { for (const r of rows) insertStop.run(r); });
const stopsBuf = [];
await streamCsv('stops.txt', (row) => {
  if (!row.stop_id) return;
  const lat = parseFloat(row.stop_lat);
  const lon = parseFloat(row.stop_lon);
  stopsBuf.push([
    row.stop_id,
    row.stop_name ?? '',
    Number.isFinite(lat) ? lat : null,
    Number.isFinite(lon) ? lon : null,
  ]);
});
insertStopsBatch(stopsBuf);

// --- routes ---
console.log('Importing routes.txt...');
const insertRoute = db.prepare('INSERT OR IGNORE INTO routes (route_id, route_short_name, route_long_name) VALUES (?, ?, ?)');
const insertRoutesBatch = db.transaction((rows) => { for (const r of rows) insertRoute.run(r); });
const routesBuf = [];
await streamCsv('routes.txt', (row) => {
  routesBuf.push([row.route_id, row.route_short_name ?? '', row.route_long_name ?? '']);
});
insertRoutesBatch(routesBuf);

// --- trips ---
console.log('Importing trips.txt...');
const insertTrip = db.prepare('INSERT INTO trips (trip_id, route_id, headsign, direction_id) VALUES (?, ?, ?, ?) ON CONFLICT(trip_id) DO UPDATE SET headsign=excluded.headsign, direction_id=excluded.direction_id');
const insertTripsBatch = db.transaction((rows) => { for (const r of rows) insertTrip.run(r); });
let tripBuf = [];
let tripTotal = 0;
await streamCsv('trips.txt', (row) => {
  tripBuf.push([row.trip_id, row.route_id, row.trip_headsign ?? '', parseInt(row.direction_id ?? '0') || 0]);
  if (tripBuf.length >= 10_000) {
    insertTripsBatch(tripBuf);
    tripTotal += tripBuf.length;
    tripBuf = [];
    process.stdout.write(`\r  ${tripTotal.toLocaleString()} rows...`);
  }
});
if (tripBuf.length) { insertTripsBatch(tripBuf); tripTotal += tripBuf.length; }
process.stdout.write(`\r  ${tripTotal.toLocaleString()} rows\n`);

// --- stop_times ---
console.log('Importing stop_times.txt...');
const insertSt = db.prepare('INSERT OR IGNORE INTO stop_times (trip_id, stop_id, arrival_secs, stop_sequence) VALUES (?, ?, ?, ?)');
const insertStBatch = db.transaction((rows) => { for (const r of rows) insertSt.run(r); });
let stBuf = [];
let stTotal = 0;
await streamCsv('stop_times.txt', (row) => {
  if (!row.stop_id || !row.trip_id) return;
  stBuf.push([row.trip_id, row.stop_id, timeToSecs(row.arrival_time), parseInt(row.stop_sequence)]);
  if (stBuf.length >= 10_000) {
    insertStBatch(stBuf);
    stTotal += stBuf.length;
    stBuf = [];
    process.stdout.write(`\r  ${stTotal.toLocaleString()} rows...`);
  }
});
if (stBuf.length) { insertStBatch(stBuf); stTotal += stBuf.length; }
process.stdout.write(`\r  ${stTotal.toLocaleString()} rows\n`);

db.close();
console.log('Done — operator data merged into gtfs.db');
