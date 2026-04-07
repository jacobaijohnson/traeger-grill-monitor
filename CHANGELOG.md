# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
