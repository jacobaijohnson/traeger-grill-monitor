# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2026-04-07

### Added

- **Docker Compose healthcheck**: Added explicit `healthcheck` block to the `traeger` service in `docker-compose.yml` (pings `/api/health` every 30s). Matches the Dockerfile `HEALTHCHECK` instruction. Docker now reports `healthy`/`unhealthy`/`starting` status via `docker ps`.
- **Docker health check commands in README**: Added `docker ps`, `docker inspect`, and `watch` examples to the Health Monitoring section for checking container health status from the host.
- **Docker CLI healthcheck flags**: The `docker run` example now includes `--health-cmd`, `--health-interval`, `--health-timeout`, `--health-start-period`, and `--health-retries` flags.
- **TUNNEL_TOKEN in docker CLI example**: The `docker run` example now includes the optional `TUNNEL_TOKEN` env var.

### Changed

- **docker-compose.yml synced with README**: The actual compose file now includes `TUNNEL_TOKEN`, `TUNNEL_METRICS`, uses `${DATABASE_URL}` from `.env` (instead of inline construction), and matches the README example exactly.
- **Cloudflare Tunnel setup docs refactored**: Tunnel section now references the main `.env` file and `docker-compose.yml` from Quick Start instead of showing partial standalone snippets. Option A (`.env`) and Option B (Docker secret) are clearly separated with file structure diagrams.
- **Tunnel Metrics docs simplified**: Instructions now reference uncommenting lines in the existing `.env` and compose files rather than showing separate compose snippets.
- **Timezone default updated**: Changed default timezone from `America/Los_Angeles` to `America/New_York` in docker-compose.yml for consistency with README.

### Fixed

- **docker-compose.yml `DATABASE_URL` mismatch**: The compose file was constructing `DATABASE_URL` inline (`mysql://traeger:${MYSQL_PASSWORD}@mysql:3306/traeger_dashboard`) instead of reading `${DATABASE_URL}` from `.env`, which conflicted with the README instructions.

## [0.3.2] - 2026-04-07

### Added

- **Tunnel health in `/api/health`**: The health endpoint now reports Cloudflare Tunnel status (`connected`, `not_configured`, `process_running`, `process_not_found`). When `TUNNEL_METRICS` is set, it probes the cloudflared `/ready` endpoint to verify connectivity. A configured tunnel with a missing process triggers `degraded` status.
- **Service health endpoint** (`GET /api/health/services`): Detailed breakdown of all container services including app, database, tunnel, push notifications, s6 service status (via `s6-svstat`), and memory usage. Useful for debugging container health issues.
- **s6 service status checking**: Parses `s6-svstat` output to report PID and uptime for `svc-traeger` and `svc-cloudflared`. Gracefully handles dev environments where s6 is not available.
- **Docker secret detection in health check**: Tunnel health check detects both `TUNNEL_TOKEN` env var and `/run/secrets/tunnel_token` Docker secret file.
- **Complete `.env` example in README**: Added a full `.env` file example with all required and optional variables, including placement instructions (same directory as `docker-compose.yml`).
- **15 new tests**: Coverage for tunnel health checking, service health endpoint, s6 service status parsing, and degraded status detection.

### Changed

- **Health check response expanded**: `/api/health` now includes a `tunnel` object alongside `database`, `vapid`, `uptime`, and `memory`.
- **Health Monitoring section rewritten**: README now documents all four endpoints with example JSON responses, tunnel status value table, and CLI health check commands.

## [0.3.1] - 2026-04-07

### Added

- **Tunnel Prometheus metrics**: Set `TUNNEL_METRICS=0.0.0.0:2000` to expose a `/metrics` endpoint from `cloudflared` with request counts, error rates, latency histograms, and HA connection status. Only active when both `TUNNEL_TOKEN` and `TUNNEL_METRICS` are set.
- **Metrics documentation**: README now includes a Tunnel Metrics subsection with available metrics table, docker-compose example with port mapping, and Prometheus scrape config.
- **11 new tests**: Coverage for `TUNNEL_METRICS` env var in Dockerfile, `--metrics` flag in run script, and metrics documentation completeness.

### Changed

- **Run script refactored**: Cloudflared arguments now built via bash array for cleaner conditional flag construction.

## [0.3.0] - 2026-04-07

### Added

- **Cloudflare Tunnel support**: Embedded `cloudflared` binary in the Docker image with an s6-overlay service that activates when `TUNNEL_TOKEN` is set. Exposes the application to the internet via Cloudflare's edge network without opening inbound firewall ports, configuring a reverse proxy, or managing TLS certificates.
- **Docker secrets support for tunnel token**: The s6 service checks `/run/secrets/tunnel_token` first, then falls back to the `TUNNEL_TOKEN` environment variable. Recommended for production deployments.
- **Health-gated tunnel startup**: The tunnel waits for the application's `/api/health` endpoint to respond before connecting to Cloudflare, preventing traffic from reaching an unready instance.
- **Security warning on tunnel startup**: Logs a warning if `DATABASE_URL` is not set when the tunnel is active, since application auth requires a database.
- **Multi-architecture cloudflared**: Dockerfile detects CPU architecture (amd64, arm64, armv7) and downloads the correct binary.
- **26 new tests**: Comprehensive test coverage for Dockerfile changes, s6 service structure, run script behavior, and documentation completeness.

### Changed

- **Architecture diagram**: Updated to show the optional `cloudflared` service alongside the Node.js application.
- **Parameters table**: Added `TUNNEL_TOKEN` to the README parameters reference.
- **ENV_TEMPLATE.md**: Added `TUNNEL_TOKEN` to the optional variables section with security guidance.

## [0.2.1] - 2026-04-07

### Changed

- **Node.js 22 → 24 LTS**: Upgraded runtime across Dockerfile, CI workflow, and documentation to Node.js 24 (Active LTS through Apr 2028)
- **Dependabot ignore rules**: Added major-version ignore rules for Node.js Docker image, TypeScript, vitest, superjson, recharts, lucide-react, @types/node, and @vitejs/plugin-react to prevent disruptive auto-PRs
- **Dependency updates**: Merged 31 minor/patch npm updates, 5 GitHub Actions version bumps (setup-node v6, build-push-action v7, action-setup v5, setup-qemu-action v4, login-action v4), and Alpine base image 3.21 → 3.23
- Added LTS-if-available policy comment to dependabot.yml

### Fixed

- Reverted accidental Node.js 25 (Current) merge — project targets LTS releases only
- Closed 8 risky major-version Dependabot PRs with review comments (Node 25, TypeScript 6, vitest 4, superjson 2, recharts 3, lucide-react 1.7, @types/node 25, @vitejs/plugin-react)

## [0.2.0] - 2026-04-07

### Added

- **Dependabot**: Automated dependency update PRs for npm, Docker, and GitHub Actions ecosystems
- **Graceful DB degradation**: `withDbRetry` returns `null` on transient connection errors instead of throwing, allowing all callers with `?? []` / `?? fallback` patterns to degrade cleanly

### Changed

- Updated all GitHub references from `jacobj` to `jacobaijohnson` (README, CONTRIBUTING, SECURITY, Dockerfile, package.json, docker-compose.yml)
- Fixed Dockerfile OCI labels: renamed from "Traeger Smoker Insight" to "Traeger Grill Monitor"
- Fixed service worker cache name from `smoker-insight-v2` to `grill-monitor-v2`
- Updated README database schema table count from 14 to 17
- Updated README project structure to include all current pages, routers, and DB modules
- Updated README test count from 335 to 422
- Fixed dates in README Versions table (2025 to 2026)
- Added version numbers to README Versions table

### Fixed

- CI test failures: tests that call DB functions no longer throw `ECONNREFUSED` in environments without MySQL
- `race-conditions.test.ts`: updated to expect `null` return on transient errors (matches new graceful degradation)
- `web-push.test.ts`: updated VAPID key test to handle both DB-available and DB-unavailable cases

## [0.1.1] - 2026-04-07

### Added

- **Structured Logging**: pino JSON logging with 9 child loggers and automatic sensitive field redaction
- **Health Monitoring**: `/api/health`, `/api/metrics`, `/api/version` endpoints
- **Rate Limiting**: 4-tier rate limiting (auth 20/min, login 5/min, admin 30/min, API 200/min)
- **Graceful Shutdown**: SIGTERM/SIGINT handler closes HTTP, disconnects MQTT, clears intervals
- **Stale Session Reaper**: Automatic cleanup of idle MQTT sessions (5-min check, 30-min threshold)
- **Telemetry Purge**: Daily automatic cleanup of telemetry data older than 90 days
- **Docker HEALTHCHECK**: 30-second interval health probe for container orchestration
- **Log Aggregation**: Optional Grafana + Loki + Promtail overlay via `docker-compose.logging.yml`
- 4 new database indexes for query performance
- Input validation bounds on all Zod schemas
- Lazy loading for route-level code splitting

### Security

- CSP headers via helmet
- JSON body limit reduced to 5MB
- Rate limiting on all API endpoints with structured logging on violations

## [0.1.0] - 2026-04-06

### Added

- **Live Grill Monitoring**: Real-time MQTT telemetry streaming via Server-Sent Events with sub-second updates
- **Cook Session Tracking**: Automatic recording with timestamped telemetry, temperature charts, duration, and alert history
- **Cook Programs**: Multi-step automation sequences with reusable templates and community sharing
- **Pellet Consumption Analytics**: Usage tracking per cook with cost estimates and brand comparisons
- **Multi-Grill Support**: Multiple Traeger grills from a single dashboard, each with independent MQTT connections
- **Web Push Notifications**: Real-time alerts via Web Push API with auto-generated VAPID keys
- **Persistent Alarm System**: Server-side re-push escalation (every 2 min, up to 30 min) with client-side audio alarm via Web Audio API
- **Admin Access Control**: Registration modes (closed, invite-only, email allowlist, open) with invite code management
- **Console-Only Password Reset**: No SMTP dependency; reset links logged to Docker console
- **CI/CD**: GitHub Actions workflows for TypeScript checking, testing, multi-arch Docker build, and automated releases
- 422 tests across 15 test files covering security, reliability, race conditions, and hardening

### Security

- AES-256-GCM encryption for stored Traeger credentials
- All database queries scoped by `ctx.user.id`
- Input validation with Zod bounds on all string and number inputs
