# 8 — Deployment & Operations

## Target environment

A self-hosted **k3s cluster on Raspberry Pi nodes**, with an in-cluster private image registry at
`192.168.1.101:30500` and Traefik ingress. The whole app — web server plus both SQLite databases —
runs from a single container image; the databases live on a PersistentVolumeClaim.

## The image (`Dockerfile`)

A multi-stage build tuned for constrained ARM nodes:

1. **`base`** — Node 22 slim, pnpm via corepack, plus native build tools (`python3`, `make`, `g++`,
   `unzip`) needed by `better-sqlite3` and `@prisma/engines`. pnpm fetch timeouts and retries are
   raised for slow Pi egress.
2. **`deps`** — full install (`--frozen-lockfile`).
3. **`build`** — `prisma generate` then `pnpm run build`; heap capped
   (`--max-old-space-size=2048`) to avoid OOM on Pi build nodes. `APP_VERSION` is baked in as a build
   arg for the version badge.
4. **`prod-deps`** — production-only install with a **hoisted (flat, symlink-free)** `node_modules`
   so Docker `COPY` works without pnpm's `.pnpm` virtual store.
5. **`runner`** — Node 22 slim with `libssl3`/`ca-certificates`, `TZ=Europe/Dublin` (critical for
   scheduled-arrival math), the built `.next`, prod `node_modules`, Prisma schema/migrations,
   generated client, and the import `scripts/`. Entry point: `next start`.

`next.config.ts` uses `output: "standalone"` and marks `better-sqlite3`, the Prisma adapter, and
`prisma` as `serverExternalPackages` so the native modules are traced correctly.

## Kubernetes topology (`deploy/helm/bustracker`)

- **Web Deployment** (`web.yaml`): a single replica with a `Recreate` strategy — SQLite is
  single-writer, so two pods must never run at once. An **init container** runs
  `prisma migrate deploy` against `${DATABASE_PATH}` before the app starts. Liveness/readiness
  probes hit `/api/healthz`. The pod mounts the shared data PVC at `/data` and receives
  `DATABASE_PATH`, `GTFS_DB_PATH`, `TZ`, and (optionally) `NTA_API_KEY` from the secret.
- **Service** (`web.yaml`): `NodePort` on **30400**, exposing the app directly on every node in
  addition to the Traefik ingress (`ingress.yaml`).
- **PVC** (`pvc.yaml`): 4Gi on the k3s `local-path` storage class, holding both `dev.db` (tiny) and
  `gtfs.db` (large).
- **Secret** (`secret.yaml`): holds `nta-api-key`, rendered only when a value is supplied.
- **GTFS refresh CronJob** (`gtfs-refresh-cronjob.yaml`): see below.

## CI/CD pipeline

Two gates run the same checks; only Jenkins ships images.

**GitHub Actions (`.github/workflows/ci.yml`)** — on every push to `main` and every PR:
`install → prisma generate → lint → typecheck → test → publish JUnit report → build`, plus a
parallel **gitleaks** secret-scan job. This is the fast feedback loop and the source of the README
badges.

**Jenkins (`Jenkinsfile`)** — a Kubernetes-agent pipeline with `node`, `helm`, and privileged
`buildah` containers:

1. **Setup** — derive `IMAGE_TAG` from the short git SHA.
2. **Install** — `pnpm install --frozen-lockfile`.
3. **Verify** — `lint`, `typecheck`, `test`, `build` (the same gate as GitHub Actions).
4. **Build & push image** (`main` only) — `buildah bud` with the `vfs` driver (with disk cleanup
   before/after, since vfs copies every layer in full), stamping
   `APP_VERSION="${IMAGE_TAG} (#${BUILD_NUMBER})"`, tagged with both the SHA and `main`, pushed to the
   private registry.
5. **Deploy** (`main` only) — `helm upgrade --install`, injecting the image tag and the
   `nta-api-key` credential, with a long `--wait` timeout suited to slow Pi rollouts.

RBAC for the Jenkins service account is in `deploy/jenkins/rbac.yaml`.

## GTFS refresh & first-run seeding

The static timetable is treated as a rebuildable artifact refreshed on a schedule:

- **CronJob** runs `scripts/refresh-gtfs.mjs` weekly (`17 3 * * 1`, Europe/Dublin). It writes to
  `GTFS_DB_PATH=/data/gtfs.db.new`, then **atomically `mv`s it over `/data/gtfs.db`** and removes the
  WAL/SHM sidecars. Because `gtfs-db.ts` watches the file inode, the running app picks up the new
  database with no restart. `concurrencyPolicy: Forbid` prevents overlapping rebuilds.
- **First deploy:** the timetable does not exist yet, so the live board is empty until it is seeded.
  Run the refresh job once by hand:

  ```bash
  kubectl -n bustracker create job --from=cronjob/bustracker-gtfs-refresh gtfs-seed
  ```

  This takes roughly 30–60 minutes on a Pi (millions of `stop_times` rows). After it completes, the
  weekly CronJob keeps the data current automatically.

## Uptime monitoring

Production uptime is monitored by **Uptime Kuma**, which runs in the shared `platform` namespace on
the same k3s cluster. It watches the deployed GetThereIE service endpoint and alerts the operator
when thresholds are breached (endpoint down or response time exceeded), complementing the app's own
`/api/healthz` liveness/readiness probes. The Uptime Kuma dashboard is at
`http://192.168.1.101:30001`; monitor configuration lives in Uptime Kuma's own database and is
managed via its web UI rather than in this repo.

## Operational notes

- **Stale-schedule symptom:** an empty board with no error usually means the imported trip IDs no
  longer match the live feed (NTA prefix rotation). Re-run the refresh job. See
  [5 — GTFS Integration Deep Dive](5-gtfs-integration-deep-dive.md).
- **Upstream outages:** the app serves stale cached feed data on NTA/Luas errors, so a brief upstream
  blip does not blank the board.
- **Version visibility:** the deployed commit/build shows in the fixed version badge (`APP_VERSION`),
  making it easy to confirm what is running.
