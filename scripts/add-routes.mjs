#!/usr/bin/env node
// Usage: node scripts/add-routes.mjs <path-to-GTFS_Dublin_Bus.zip>
import Database from 'better-sqlite3';
import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_ZIP = process.argv[2];

if (!GTFS_ZIP) {
  console.error('Usage: node scripts/add-routes.mjs <path-to-GTFS_Dublin_Bus.zip>');
  process.exit(1);
}

const DB_PATH = process.env.GTFS_DB_PATH ?? path.join(__dirname, '..', 'gtfs.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS routes (
    route_id         TEXT PRIMARY KEY,
    route_short_name TEXT NOT NULL,
    route_long_name  TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS trips (
    trip_id      TEXT    PRIMARY KEY,
    route_id     TEXT    NOT NULL,
    headsign     TEXT    NOT NULL DEFAULT '',
    direction_id INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
`);

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

console.log('Importing routes.txt...');
const insertRoute = db.prepare('INSERT OR IGNORE INTO routes (route_id, route_short_name, route_long_name) VALUES (?, ?, ?)');
const insertRoutesBatch = db.transaction((rows) => { for (const r of rows) insertRoute.run(r); });
const routesBuf = [];
await streamCsv('routes.txt', (row) => {
  routesBuf.push([row.route_id, row.route_short_name ?? '', row.route_long_name ?? '']);
});
insertRoutesBatch(routesBuf);

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

db.close();
console.log('Done — routes and trips tables added to gtfs.db');
