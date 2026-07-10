#!/usr/bin/env node
// Downloads fresh GTFS data from NTA and runs the full import pipeline.
// No arguments needed. Run manually: node scripts/refresh-gtfs.mjs
// Also called automatically by setup.mjs when gtfs.db is missing.
import { createWriteStream, existsSync, unlinkSync } from 'fs';
import { Writable } from 'stream';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_URL = 'https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip';
const ZIP_PATH = path.join(tmpdir(), 'GTFS_Dublin_Bus.zip');

function run(script, ...args) {
  return new Promise((resolve, reject) => {
    console.log(`\n→ ${script}`);
    const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
      stdio: 'inherit',
    });
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code}`)));
    child.on('error', reject);
  });
}

console.log('Downloading GTFS_Dublin_Bus.zip from NTA...');
const res = await fetch(GTFS_URL);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

const total = parseInt(res.headers.get('content-length') || '0', 10);
let received = 0;

const progressInterval = setInterval(() => {
  const mb = Math.round(received / 1e6);
  if (total) process.stdout.write(`\r  ${mb} / ${Math.round(total / 1e6)} MB`);
  else process.stdout.write(`\r  ${mb} MB`);
}, 500);

const dest = createWriteStream(ZIP_PATH);
await res.body.pipeTo(Writable.toWeb(dest));
clearInterval(progressInterval);
console.log(`\n  Downloaded ${Math.round(received / 1e6) || '?'} MB`);

try {
  await run('import-gtfs.mjs', ZIP_PATH);
  await run('add-stops.mjs', ZIP_PATH);
  await run('add-routes.mjs', ZIP_PATH);
  await run('add-calendar.mjs', ZIP_PATH);
  await run('add-luas.mjs');
} finally {
  if (existsSync(ZIP_PATH)) {
    unlinkSync(ZIP_PATH);
    console.log('\nCleaned up zip.');
  }
}

console.log('\nGTFS import complete.');
