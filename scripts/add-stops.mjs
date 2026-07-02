#!/usr/bin/env node
// Patches the existing gtfs.db with a stops table (stop_id, stop_name).
// Usage: node scripts/add-stops.mjs <path-to-GTFS_zip>
import Database from 'better-sqlite3';
import readline from 'readline';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_ZIP = process.argv[2];
const DB_PATH = path.join(__dirname, '..', 'gtfs.db');

if (!GTFS_ZIP) { console.error('Usage: node scripts/add-stops.mjs <zip>'); process.exit(1); }
if (!existsSync(DB_PATH)) { console.error('gtfs.db not found — run import-gtfs first'); process.exit(1); }

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  DROP TABLE IF EXISTS stops;
  CREATE TABLE stops (stop_id TEXT PRIMARY KEY, stop_name TEXT NOT NULL);
`);

const insert = db.prepare('INSERT OR REPLACE INTO stops (stop_id, stop_name) VALUES (?, ?)');
const batchInsert = db.transaction((rows) => { for (const r of rows) insert.run(r); });

await new Promise((resolve, reject) => {
  const child = spawn('unzip', ['-p', GTFS_ZIP, 'stops.txt']);
  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  let firstLine = true;
  let idxId = 0, idxName = 2;
  let batch = [], total = 0;

  rl.on('line', (line) => {
    if (!line) return;
    if (firstLine) {
      firstLine = false;
      const cols = line.split(',');
      idxId   = cols.indexOf('stop_id');
      idxName = cols.indexOf('stop_name');
      return;
    }
    const f = line.split(',');
    const stopId   = f[idxId]?.trim();
    const stopName = f[idxName]?.trim();
    if (!stopId || !stopName) return;
    batch.push([stopId, stopName]);
    if (batch.length >= 5_000) {
      batchInsert(batch); total += batch.length; batch = [];
      process.stdout.write(`\r  ${total.toLocaleString()} stops...`);
    }
  });

  rl.on('close', () => {
    if (batch.length) { batchInsert(batch); total += batch.length; }
    process.stdout.write(`\r  ${total.toLocaleString()} stops\n`);
    resolve(total);
  });
  child.on('error', reject);
});

db.close();
console.log('Done — stops table added to gtfs.db');
