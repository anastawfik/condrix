# ─────────────────────────────────────────────────────────────────────────────
# NexusCore — Multi-stage Dockerfile
# Targets: base, deps, build, core, maestro, web-build, web
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage: base ──────────────────────────────────────────────────────────────
# Shared base with native build tools for node-pty, better-sqlite3
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Stage: deps ──────────────────────────────────────────────────────────────
# Install all dependencies (production + dev for build step)
FROM base AS deps
RUN npm install -g @anthropic-ai/claude-code
COPY package.json package-lock.json ./
# All workspace package.json files (npm ci needs the full workspace tree)
COPY apps/core/package.json apps/core/
COPY apps/maestro/package.json apps/maestro/
COPY apps/client-web/package.json apps/client-web/
COPY apps/client-desktop/package.json apps/client-desktop/
COPY apps/client-mobile/package.json apps/client-mobile/
COPY apps/client-cli/package.json apps/client-cli/
COPY apps/docs/package.json apps/docs/
COPY libs/protocol/package.json libs/protocol/
COPY libs/skills/package.json libs/skills/
COPY libs/mcp-configs/package.json libs/mcp-configs/
COPY libs/client-shared/package.json libs/client-shared/
COPY libs/client-components/package.json libs/client-components/
RUN npm install

# ── Stage: build ─────────────────────────────────────────────────────────────
# Full monorepo build (all packages)
FROM deps AS build
COPY . .
RUN npx nx run-many -t build

# ── Stage: core ──────────────────────────────────────────────────────────────
# Production Core daemon
FROM node:22-bookworm-slim AS core
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/core ./apps/core
COPY --from=build /app/libs/protocol ./libs/protocol
COPY --from=build /app/libs/skills ./libs/skills
COPY --from=build /app/libs/mcp-configs ./libs/mcp-configs

ENV NODE_ENV=production
EXPOSE 9100
CMD ["node", "apps/core/dist/cli.js"]

# ── Stage: maestro ───────────────────────────────────────────────────────────
# Production Maestro orchestration service
FROM node:22-bookworm-slim AS maestro
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/maestro ./apps/maestro
COPY --from=build /app/libs/protocol ./libs/protocol

ENV NODE_ENV=production
EXPOSE 9200
CMD ["node", "apps/maestro/dist/cli.js"]

# ── Stage: web-build ─────────────────────────────────────────────────────────
# Build web client with VITE_* env vars baked in
FROM deps AS web-build
ARG VITE_DEFAULT_MAESTRO_URL=wss://maestro.yourdomain.com
ENV VITE_DEFAULT_MAESTRO_URL=${VITE_DEFAULT_MAESTRO_URL}
COPY . .
RUN npx nx run @nexus-core/client-web:build

# ── Stage: web ───────────────────────────────────────────────────────────────
# Serve static web assets via Nginx
FROM nginx:alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/client-web/dist /usr/share/nginx/html
EXPOSE 80
