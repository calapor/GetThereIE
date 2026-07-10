#!/usr/bin/env node
// Creates symlinks for shared files that are gitignored.
// Runs automatically via postinstall.
import { existsSync, symlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shared = '/Users/roconnor/conductor/repos/bustrackertemp';

const links = [
  { src: path.join(shared, 'gtfs.db'),    dest: path.join(root, 'gtfs.db') },
  { src: path.join(shared, '.env.local'), dest: path.join(root, '.env.local') },
];

for (const { src, dest } of links) {
  if (existsSync(dest)) continue;
  if (!existsSync(src)) { console.warn(`setup: source not found: ${src}`); continue; }
  symlinkSync(src, dest);
  console.log(`setup: linked ${path.basename(dest)}`);
}

// Auto-import GTFS if gtfs.db is still missing after symlinking.
// Skipped in CI/Docker — the Dockerfile runs refresh-gtfs.mjs explicitly.
if (!process.env.CI && !existsSync(path.join(root, 'gtfs.db'))) {
  console.log('setup: gtfs.db not found — downloading GTFS data (this takes a few minutes)...');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'refresh-gtfs.mjs')], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('setup: GTFS import failed — run `node scripts/refresh-gtfs.mjs` manually');
  }
}
