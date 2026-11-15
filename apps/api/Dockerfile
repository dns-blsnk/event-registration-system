# syntax=docker/dockerfile:1
# API image for Render. Build from the repo root: docker build -f apps/api/Dockerfile .

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN corepack enable
WORKDIR /repo

# Build. `pnpm fetch` needs only the lockfile and root manifest, so the download layer stays cached across source
# edits; the offline install then runs the root `prepare` script (shared package and Prisma client).
# `pnpm deploy` copies the API's `files` (dist, schema, migrations) with production dependencies
# only to /prod/api; the shared package is copied in, not linked.
FROM base AS build
# The root manifest carries the list of dependencies allowed to run build scripts.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile --offline --filter @ers/api...
RUN pnpm --filter @ers/api build \
 && pnpm --filter @ers/api deploy --prod --legacy /prod/api

# Runtime: no compilers, no dev dependencies, not root. Prisma's migration engine needs OpenSSL.
FROM node:24-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
USER node
EXPOSE 3000
# Pending migrations are applied on start (Render's free plan has no pre-deploy step), then `exec`
# hands PID 1 to Node, so the stop signal reaches it and the app shuts down cleanly.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
