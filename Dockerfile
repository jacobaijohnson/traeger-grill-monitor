# syntax=docker/dockerfile:1
# ─── Traeger Grill Monitor — LinuxServer.io Compatible ───
# Default port: 8420 (IANA unassigned, no homelab conflicts)

# ─── Stage 1: Build client + server ──────────────────────
FROM node:24-alpine AS builder

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
FROM ghcr.io/linuxserver/baseimage-alpine:3.23

# Set version labels (LSIO convention)
ARG BUILD_DATE
ARG VERSION
LABEL build_version="traeger-grill-monitor version:- ${VERSION} Build-date:- ${BUILD_DATE}"
LABEL maintainer="jacobaijohnson"
LABEL org.opencontainers.image.title="Traeger Grill Monitor"
LABEL org.opencontainers.image.description="Real-time Traeger grill monitoring dashboard with cook tracking, pellet consumption, and multi-grill support"
LABEL org.opencontainers.image.source="https://github.com/jacobaijohnson/traeger-grill-monitor"
LABEL org.opencontainers.image.licenses="MIT"

# Environment defaults
ENV \
  NODE_ENV=production \
  HOME=/app \
  PORT=8420 \
  TUNNEL_TOKEN="" \
  TUNNEL_METRICS=""

# Install Node.js runtime and cloudflared (Cloudflare Tunnel client)
RUN \
  echo "**** install runtime packages ****" && \
  apk add --no-cache \
    nodejs \
    npm && \
  echo "**** install cloudflared ****" && \
  ARCH=$(uname -m) && \
  case "${ARCH}" in \
    x86_64)  CF_ARCH="amd64" ;; \
    aarch64) CF_ARCH="arm64" ;; \
    armv7l)  CF_ARCH="arm" ;; \
    *)       echo "Unsupported arch: ${ARCH}"; exit 1 ;; \
  esac && \
  wget -q -O /usr/local/bin/cloudflared \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" && \
  chmod +x /usr/local/bin/cloudflared && \
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

# DPL-1: Health check for Docker orchestrators (Compose, Swarm, K8s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

# Ports and volumes (LSIO convention: /config for persistent data)
EXPOSE 8420
VOLUME /config
