#!/usr/bin/env node
// Adds calendar.txt, calendar_dates.txt, and service_id to the trips table.
// Run after import-gtfs.mjs + add-routes.mjs.
// Usage: node scripts/add-calendar.mjs <path-to-GTFS_Dublin_Bus.zip>
import Database from 'better-sqlite3';
import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_ZIP = process.argv[2];

if (!GTFS_ZIP) {
  console.error('Usage: node scripts/add-calendar.mjs <path-to-GTFS_Dublin_Bus.zip>');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'gtfs.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Add service_id to trips if not already there
const cols = db.prepare("PRAGMA table_info(trips)").all().map(r => r.name);
if (!cols.includes('service_id')) {
  db.exec("ALTER TABLE trips ADD COLUMN service_id TEXT NOT NULL DEFAULT ''");
  console.log('Added service_id column to trips table');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS calendar (
    service_id TEXT PRIMARY KEY,
    monday     INTEGER NOT NULL DEFAULT 0,
    tuesday    INTEGER NOT NULL DEFAULT 0,
    wednesday  INTEGER NOT NULL DEFAULT 0,
    thursday   INTEGER NOT NULL DEFAULT 0,
    friday     INTEGER NOT NULL DEFAULT 0,
    saturday   INTEGER NOT NULL DEFAULT 0,
    sunday     INTEGER NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendar_dates (
    service_id     TEXT NOT NULL,
    date           TEXT NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date)
  );
`);

function streamCsv(filename, onRow) {
  return new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-p', GTFS_ZIP, filename]);
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    let header = null;
    let count = 0;
    rl.on('line', (line) => {
      if (!line.trim()) return;
      if (!header) {
        // Strip BOM if present
        header = line.replace(/^﻿/, '').split(',').map(h => h.trim());
        return;
      }
      const fields = line.split(',');
      const row = {};
      header.forEach((col, i) => { row[col] = (fields[i] ?? '').trim(); });
      onRow(row);
      count++;
    });
    rl.on('close', () => { console.log(`  ${count.toLocaleString()} rows`); resolve(); });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', reject);
  });
}

// Update trips.service_id from trips.txt
console.log('Updating trips.service_id from trips.txt...');
const updateTrip = db.prepare('UPDATE trips SET service_id = ? WHERE trip_id = ?');
const updateBatch = db.transaction((rows) => { for (const [svc, trip] of rows) updateTrip.run(svc, trip); });
let tripBuf = [];
let tripTotal = 0;
await streamCsv('trips.txt', (row) => {
  if (!row.trip_id || !row.service_id) return;
  tripBuf.push([row.service_id, row.trip_id]);
  if (tripBuf.length >= 10_000) {
    updateBatch(tripBuf);
    tripTotal += tripBuf.length;
    tripBuf = [];
    process.stdout.write(`\r  ${tripTotal.toLocaleString()} updated...`);
  }
});
if (tripBuf.length) { updateBatch(tripBuf); tripTotal += tripBuf.length; }
process.stdout.write(`\r  ${tripTotal.toLocaleString()} rows\n`);

// Import calendar.txt
console.log('Importing calendar.txt...');
const insertCal = db.prepare(`
  INSERT OR REPLACE INTO calendar
    (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertCalBatch = db.transaction((rows) => { for (const r of rows) insertCal.run(...r); });
const calBuf = [];
await streamCsv('calendar.txt', (row) => {
  calBuf.push([
    row.service_id,
    parseInt(row.monday) || 0,
    parseInt(row.tuesday) || 0,
    parseInt(row.wednesday) || 0,
    parseInt(row.thursday) || 0,
    parseInt(row.friday) || 0,
    parseInt(row.saturday) || 0,
    parseInt(row.sunday) || 0,
    row.start_date,
    row.end_date,
  ]);
});
insertCalBatch(calBuf);

// Import calendar_dates.txt
console.log('Importing calendar_dates.txt...');
const insertCd = db.prepare('INSERT OR REPLACE INTO calendar_dates (service_id, date, exception_type) VALUES (?, ?, ?)');
const insertCdBatch = db.transaction((rows) => { for (const r of rows) insertCd.run(...r); });
const cdBuf = [];
await streamCsv('calendar_dates.txt', (row) => {
  cdBuf.push([row.service_id, row.date, parseInt(row.exception_type) || 0]);
});
insertCdBatch(cdBuf);

db.close();
console.log('Done — calendar tables added to gtfs.db');
