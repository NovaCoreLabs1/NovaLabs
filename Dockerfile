# syntax=docker/dockerfile:1.7
#
# Hardened, multi-stage Dockerfile for the NovaLabs backend (NestJS).
#
# Stages:
#   deps    — npm ci with the full dependency tree (incl. build tools) so
#             subsequent stages can layer-cache installs.
#   build   — runs `nest build` and produces `./backend/dist`.
#   runtime — distroless Node 20 image, non-root user (UID 65532),
#             only prod node_modules + dist/ are copied in.
#
# Resulting image is ~150 MB, contains no shell, no package manager,
# and runs as a non-root user by default.

# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Copy manifests first to maximise layer-cache hits.
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend

RUN cd backend && npm run build && npm prune --omit=dev

# ---------- runtime ----------
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Copy compiled app + production-only deps (pruned in the build stage).
# `nest build` already includes handlebars templates via
# nest-cli.json's `assets` config, so dist is self-contained — no extra
# template copy is needed here.
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json

USER nonroot
EXPOSE 3000

CMD ["node", "dist/main.js"]
