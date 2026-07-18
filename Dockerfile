# Build the Next.js bus tracker app from source.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV CI=true
ENV PNPM_CONFIG_CONFIRM_MODULES_PURGE=false
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
# better-sqlite3 and @prisma/engines require native compilation tools.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false

FROM deps AS build
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
# Cap heap to avoid OOM on memory-constrained (Raspberry Pi) build nodes.
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate
RUN pnpm run build

# Production-only deps with a hoisted (flat, symlink-free) node_modules layout
# so Docker COPY works correctly without pulling in pnpm's .pnpm virtual store.
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod \
    --config.node-linker=hoisted \
    --config.confirmModulesPurge=false

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 unzip ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
# Correct timezone for GTFS scheduled arrival calculations.
ENV TZ=Europe/Dublin
WORKDIR /app

# Production node_modules (flat layout — no .pnpm symlinks)
COPY --from=prod-deps /app/node_modules ./node_modules
# Pre-built Next.js output
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
# Prisma schema + migrations (for the init container that runs migrate deploy)
COPY --from=build /app/prisma ./prisma
# Generated Prisma client (compiled into .next bundles, but kept here for safety)
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/scripts ./scripts

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
