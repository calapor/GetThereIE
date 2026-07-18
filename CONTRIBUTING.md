# Contributing

## Setup
- Node 22, pnpm 11.1.1 (`corepack enable && corepack prepare pnpm@11.1.1 --activate`).
- `pnpm install`, then copy `.env.example` to `.env.local` and set `NTA_API_KEY` (optional in dev).
- A populated `gtfs.db` is required for live ETAs — see the README "Static GTFS data" section.

## Scripts
- `pnpm dev` — dev server on http://localhost:3005
- `pnpm run lint` / `pnpm run typecheck` — static checks
- `pnpm test` — Vitest unit tests (pure functions only; no network/DB)
- `pnpm run build` — production build

## Pull requests
- Keep changes focused; add/extend unit tests for pure logic.
- CI (lint, typecheck, test, build, secret-scan) must pass. Never commit secrets.
