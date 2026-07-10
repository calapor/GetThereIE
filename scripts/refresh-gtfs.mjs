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
const FEEDS = [
  { name: 'GTFS_Dublin_Bus',  url: 'https://www.transportforireland.ie/transitData/Data/GTFS_Dublin_Bus.zip' },
  { name: 'GTFS_GoAhead',     url: 'https://www.transportforireland.ie/transitData/Data/GTFS_GoAhead.zip' },
];
// Keep legacy single-zip path for callers that pass import-gtfs.mjs directly
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

async function download(url, dest) {
  console.log(`Downloading ${path.basename(dest)} from NTA...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const progressInterval = setInterval(() => {
    process.stdout.write(total ? `\r  ? / ${Math.round(total / 1e6)} MB` : '\r  downloading...');
  }, 500);
  const file = createWriteStream(dest);
  await res.body.pipeTo(Writable.toWeb(file));
  clearInterval(progressInterval);
  console.log(`\n  Done.`);
}

const zipPaths = FEEDS.map((f) => path.join(tmpdir(), `${f.name}.zip`));

try {
  // Download all feeds
  for (let i = 0; i < FEEDS.length; i++) {
    await download(FEEDS[i].url, zipPaths[i]);
  }

  // Full import from the primary Dublin Bus feed
  await run('import-gtfs.mjs', zipPaths[0]);
  await run('add-stops.mjs', zipPaths[0]);
  await run('add-routes.mjs', zipPaths[0]);
  await run('add-calendar.mjs', zipPaths[0]);

  // Merge each additional operator feed
  for (let i = 1; i < FEEDS.length; i++) {
    await run('add-operator.mjs', zipPaths[i]);
  }

  await run('add-luas.mjs');
} finally {
  for (const p of zipPaths) {
    if (existsSync(p)) { unlinkSync(p); console.log(`Cleaned up ${path.basename(p)}.`); }
  }
}

console.log('\nGTFS import complete.');
