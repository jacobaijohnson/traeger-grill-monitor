# syntax=docker/dockerfile:1
# ─── Traeger Smoker Insight — LinuxServer.io Compatible ───
# Default port: 8420 (IANA unassigned, no homelab conflicts)

# ─── Stage 1: Build client + server ──────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ patches/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY client/ client/
COPY server/ server/
COPY shared/ shared/
COPY drizzle/ drizzle/
COPY vite.config.ts tsconfig.json ./

# Build client (Vite) and server (esbuild)
RUN pnpm run build

# Prune devDependencies for smaller production image
RUN pnpm prune --prod

# ─── Stage 2: Production (LSIO base) ─────────────────────
FROM ghcr.io/linuxserver/baseimage-alpine:3.21

# Set version labels (LSIO convention)
ARG BUILD_DATE
ARG VERSION
LABEL build_version="traeger-smoker-insight version:- ${VERSION} Build-date:- ${BUILD_DATE}"
LABEL maintainer="jacobj"
LABEL org.opencontainers.image.title="Traeger Smoker Insight"
LABEL org.opencontainers.image.description="Real-time Traeger grill monitoring dashboard with cook tracking, pellet consumption, and multi-grill support"
LABEL org.opencontainers.image.source="https://github.com/jacobj/traeger-smoker-insight"
LABEL org.opencontainers.image.licenses="MIT"

# Environment defaults
ENV \
  NODE_ENV=production \
  HOME=/app \
  PORT=8420

# Install Node.js runtime (no build tools needed)
RUN \
  echo "**** install runtime packages ****" && \
  apk add --no-cache \
    nodejs \
    npm && \
  echo "**** create app directory ****" && \
  mkdir -p /app && \
  echo "**** cleanup ****" && \
  rm -rf /tmp/*

# Copy built artifacts from builder stage
# dist/index.js = bundled server, dist/public/ = Vite-built client
COPY --from=builder /app/dist /app/dist

# Copy production node_modules from builder (pruned)
COPY --from=builder /app/node_modules /app/node_modules

# Copy package.json for runtime reference
COPY --from=builder /app/package.json /app/package.json

# Copy drizzle migrations (needed for DB schema setup)
COPY --from=builder /app/drizzle /app/drizzle

# Copy shared types
COPY --from=builder /app/shared /app/shared

# Add s6-overlay service definitions and init scripts
COPY root/ /

# Ports and volumes (LSIO convention: /config for persistent data)
EXPOSE 8420
VOLUME /config
