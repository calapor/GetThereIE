#!/usr/bin/env node
// Usage: node scripts/import-gtfs.mjs <path-to-GTFS_Dublin_Bus.zip>
import Database from 'better-sqlite3';
import readline from 'readline';
import { spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_ZIP = process.argv[2];

if (!GTFS_ZIP) {
  console.error('Usage: node scripts/import-gtfs.mjs <path-to-GTFS_Dublin_Bus.zip>');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'gtfs.db');

if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log('Removed old gtfs.db');
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE stop_times (
    trip_id      TEXT    NOT NULL,
    stop_id      TEXT    NOT NULL,
    arrival_secs INTEGER NOT NULL,
    stop_sequence INTEGER NOT NULL,
    PRIMARY KEY (trip_id, stop_sequence)
  );
  CREATE INDEX idx_trip_stop ON stop_times(trip_id, stop_id);
`);

function timeToSecs(t) {
  const [h, m, s] = t.split(':');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
}

const insertStmt = db.prepare(
  'INSERT OR IGNORE INTO stop_times (trip_id, stop_id, arrival_secs, stop_sequence) VALUES (?, ?, ?, ?)'
);
const batchInsert = db.transaction((rows) => {
  for (const r of rows) insertStmt.run(r);
});

function streamFile(filename) {
  return new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-p', GTFS_ZIP, filename]);
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

    let firstLine = true;
    // Column indices discovered from header
    let idxTripId = 0, idxArrival = 1, idxStopId = 3, idxSeq = 4;

    let batch = [];
    let total = 0;

    rl.on('line', (line) => {
      if (!line) return;

      if (firstLine) {
        firstLine = false;
        const cols = line.split(',');
        idxTripId  = cols.indexOf('trip_id');
        idxArrival = cols.indexOf('arrival_time');
        idxStopId  = cols.indexOf('stop_id');
        idxSeq     = cols.indexOf('stop_sequence');
        return;
      }

      const f = line.split(',');
      const tripId = f[idxTripId];
      const arrivalRaw = f[idxArrival];
      const stopId = f[idxStopId];
      const seq = parseInt(f[idxSeq]);

      if (!tripId || !arrivalRaw || !stopId || isNaN(seq)) return;
      if (!stopId.includes('DB')) return; // Dublin Bus stops only

      batch.push([tripId, stopId, timeToSecs(arrivalRaw), seq]);

      if (batch.length >= 10_000) {
        batchInsert(batch);
        total += batch.length;
        batch = [];
        process.stdout.write(`\r  ${total.toLocaleString()} rows...`);
      }
    });

    rl.on('close', () => {
      if (batch.length > 0) {
        batchInsert(batch);
        total += batch.length;
      }
      process.stdout.write(`\r  ${total.toLocaleString()} rows\n`);
      resolve(total);
    });

    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', reject);
  });
}

console.log('Importing stop_times.txt...');
await streamFile('stop_times.txt');
db.close();
console.log(`Done — gtfs.db written to ${DB_PATH}`);
