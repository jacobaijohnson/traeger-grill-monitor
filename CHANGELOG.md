# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-04-07

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
- **Structured Logging**: pino JSON logging with 9 child loggers and automatic sensitive field redaction
- **Health Monitoring**: `/api/health`, `/api/metrics`, `/api/version` endpoints
- **Rate Limiting**: 4-tier rate limiting (auth 20/min, login 5/min, admin 30/min, API 200/min)
- **Graceful Shutdown**: SIGTERM/SIGINT handler closes HTTP, disconnects MQTT, clears intervals
- **Stale Session Reaper**: Automatic cleanup of idle MQTT sessions (5-min check, 30-min threshold)
- **Telemetry Purge**: Daily automatic cleanup of telemetry data older than 90 days
- **Docker HEALTHCHECK**: 30-second interval health probe for container orchestration
- **Log Aggregation**: Optional Grafana + Loki + Promtail overlay via `docker-compose.logging.yml`
- **CI/CD**: GitHub Actions workflows for TypeScript checking, testing, multi-arch Docker build, and automated releases
- **422 tests** across 15 test files covering security, reliability, race conditions, and hardening

### Security

- AES-256-GCM encryption for stored Traeger credentials
- All database queries scoped by `ctx.user.id`
- Input validation with Zod bounds on all string and number inputs
- CSP headers via helmet
- JSON body limit reduced to 5MB
- Rate limiting on all API endpoints with structured logging on violations
