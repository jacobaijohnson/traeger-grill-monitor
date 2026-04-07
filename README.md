# Traeger Smoker Insight

Real-time monitoring dashboard for Traeger grills. Track temperatures, manage cook sessions, log pellet consumption, and automate multi-step cook programs — all from a self-hosted web interface.

Built for the homelab community. Runs as a single Docker container following [LinuxServer.io](https://www.linuxserver.io/) conventions (s6-overlay, PUID/PGID, `/config` volume).

---

## Features

**Live Grill Monitoring** connects directly to Traeger's MQTT broker via your existing Traeger account credentials. The dashboard streams real-time grill temperature, probe temperature, and grill state with sub-second updates through Server-Sent Events.

**Cook Session Tracking** automatically records every cook with timestamped telemetry readings. Review historical sessions with temperature charts, duration, peak temperatures, and alert history. Sessions are stored in MySQL with full query support.

**Cook Programs** let you define multi-step automation sequences (e.g., smoke at 180 for 2 hours, then raise to 225 until probe hits 195). Programs can be built from reusable templates and executed against any connected grill.

**Pellet Consumption Analytics** tracks pellet usage per cook and over time. View consumption trends, cost estimates, and brand comparisons to optimize your pellet purchases.

**Multi-Grill Support** manages multiple Traeger grills from a single dashboard. Each grill maintains its own MQTT connection, telemetry stream, and cook history.

**Push Notifications** delivers real-time alerts to your phone or desktop even when the browser tab is closed. Powered by the Web Push API with auto-generated VAPID keys. Get notified for temperature alerts, stall detection, stall recovery, cook phase changes, and escalating alarms. Per-user notification preferences let each user choose which alerts they want to receive.

**Persistent Alarm System** ensures critical alerts cannot be silently missed. When an alarm-type alert fires (temperature target reached, grill disconnected, escalating cook alarm), the server re-pushes the notification every 2 minutes with increasing urgency for up to 30 minutes. If the app is open, a synthesized audio alarm tone plays through the Web Audio API with an escalating pattern (faster warble, higher pitch over time). A red pulsing banner appears at the top of the screen with per-alarm dismiss buttons. Dismissing from any surface (notification action, in-app banner, or closing the notification) stops both the audio loop and the server-side escalation.

**Admin Access Control** provides flexible registration modes (closed, invite-only, email allowlist, open) so you control who can access your instance. Admin users manage invites, allowlists, and user roles from a built-in settings panel.

**Console-Only Password Reset** keeps the stack simple with no SMTP dependency. When a user requests a password reset, the reset link is logged to the Docker container console. The admin copies the link and shares it directly. No email server configuration needed.

---

## Supported Architectures

| Architecture | Available |
|:------------:|:---------:|
| x86-64 | Yes |
| arm64 | Yes |

The multi-stage Dockerfile builds on `node:22-alpine` and produces a final image from `ghcr.io/linuxserver/baseimage-alpine:3.21`.

---

## Application Setup

Access the web interface at `http://<your-host>:8420` after starting the container.

On first boot, if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, an admin account is created automatically. Otherwise, registration is closed by default — the first user to register through the UI when registration is opened becomes the initial user.

To link your Traeger account, navigate to **Settings** in the sidebar and enter your Traeger email and password. The app authenticates against Traeger's Cognito service and establishes an MQTT connection to stream live grill data. No Traeger API keys are needed.

If running behind a reverse proxy (Traefik, SWAG, Nginx Proxy Manager, Caddy), set `BETTER_AUTH_URL` to your external URL so authentication callbacks resolve correctly.

---

## Usage

### docker-compose (recommended)

```yaml
services:
  traeger:
    image: ghcr.io/jacobj/traeger-smoker-insight:latest
    container_name: traeger-smoker-insight
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      - NODE_ENV=production
      - PORT=8420
      - DATABASE_URL=mysql://traeger:${MYSQL_PASSWORD:-traeger_pass}@mysql:3306/traeger_dashboard
      - JWT_SECRET=${JWT_SECRET}
      - BETTER_AUTH_URL=${BETTER_AUTH_URL:-http://localhost:8420}
      - ADMIN_EMAIL=${ADMIN_EMAIL:-}        # optional
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-}  # optional
    volumes:
      - ./config:/config
    ports:
      - 8420:8420
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    container_name: traeger-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-rootpass}
      MYSQL_DATABASE: traeger_dashboard
      MYSQL_USER: traeger
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-traeger_pass}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysql_data:
```

### docker cli

```bash
docker run -d \
  --name=traeger-smoker-insight \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=America/New_York \
  -e NODE_ENV=production \
  -e PORT=8420 \
  -e DATABASE_URL=mysql://traeger:pass@your-mysql-host:3306/traeger_dashboard \
  -e JWT_SECRET=your-random-64-char-string \
  -e BETTER_AUTH_URL=http://your-host:8420 \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=your-secure-password \
  -p 8420:8420 \
  -v /path/to/config:/config \
  --restart unless-stopped \
  ghcr.io/jacobj/traeger-smoker-insight:latest
```

### Using an existing MySQL/MariaDB instance

If you already run MySQL or MariaDB on your network, skip the bundled `mysql` service entirely. Point `DATABASE_URL` at your existing instance and create the database beforehand:

```sql
CREATE DATABASE traeger_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'traeger'@'%' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON traeger_dashboard.* TO 'traeger'@'%';
FLUSH PRIVILEGES;
```

The application runs Drizzle migrations automatically on startup to create and update tables.

---

## Parameters

Containers are configured using parameters passed at runtime. These parameters are separated by a colon and indicate `<external>:<internal>` respectively. For example, `-p 9000:8420` would expose port 8420 from inside the container on port 9000 on the host.

| Parameter | Function |
|-----------|----------|
| `-p 8420:8420` | Web UI and API |
| `-e PUID=1000` | User ID for file permissions — see below |
| `-e PGID=1000` | Group ID for file permissions — see below |
| `-e TZ=America/New_York` | Timezone ([list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |
| `-e DATABASE_URL` | **Required.** MySQL connection string |
| `-e JWT_SECRET` | **Required.** Random string for signing session cookies (`openssl rand -hex 32`) |
| `-e BETTER_AUTH_URL` | Public URL of the app. Set when behind a reverse proxy. Default: `http://localhost:8420` |
| `-e ADMIN_EMAIL` | Email for bootstrap admin account (created on first boot) |
| `-e ADMIN_PASSWORD` | Password for bootstrap admin account (minimum 8 characters) |
| `-e PORT=8420` | Internal container port. Rarely needs changing. |
| `-v /config` | Persistent application data |

---

## Port Selection

Port **8420** was chosen deliberately after researching common homelab service ports. The entire 8418–8422 range is IANA-unassigned, and 8420 does not conflict with any widely-used self-hosted application:

| Service | Port | Conflict? |
|---------|------|-----------|
| Plex | 32400 | No |
| Sonarr | 8989 | No |
| Radarr | 7878 | No |
| Home Assistant | 8123 | No |
| Grafana | 3000 | No |
| Portainer | 9000 | No |
| Traefik | 8080 | No |
| Unifi | 8443 | No |
| Pi-hole | 80/53 | No |
| Jellyfin | 8096 | No |

---

## Environment Variables from Files (Docker Secrets)

You can set any environment variable from a file by using the `FILE__` prefix:

```bash
-e FILE__JWT_SECRET=/run/secrets/jwt_secret
```

This sets the `JWT_SECRET` environment variable based on the contents of the `/run/secrets/jwt_secret` file.

---

## User / Group Identifiers

When using volumes (`-v` flags), permissions issues can arise between the host OS and the container. This is avoided by specifying the user `PUID` and group `PGID`.

Ensure any volume directories on the host are owned by the same user you specify, and permissions issues will not occur.

```bash
id your_user
# Example output: uid=1000(your_user) gid=1000(your_user) groups=1000(your_user)
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui | Single-page dashboard UI |
| Backend | Express 4, tRPC 11 | Type-safe API with end-to-end types |
| Database | MySQL 8 via Drizzle ORM | Telemetry storage, session history, user management |
| Auth | Better Auth | Email/password authentication with admin plugin |
| Real-time | MQTT.js, Server-Sent Events | Traeger broker connection and live UI updates |
| Encryption | AES-256-GCM | Traeger tokens encrypted at rest in database |
| Push | Web Push API (VAPID) | Background notifications to any subscribed device |
| Container | s6-overlay on Alpine Linux | Process supervision following LSIO conventions |
| Build | Vite (client), esbuild (server) | Fast builds with tree-shaking |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Docker Container (s6-overlay)                  │
│                                                 │
│  ┌───────────────┐    ┌──────────────────────┐  │
│  │  Node.js      │    │  Static Assets       │  │
│  │  Express +    │    │  (Vite-built React)  │  │
│  │  tRPC Server  │◄──►│  served by Express   │  │
│  └───────┬───────┘    └──────────────────────┘  │
│          │                                      │
│          ├── Better Auth (sessions, users)       │
│          ├── MQTT Manager (per-user connections) │
│          ├── SSE Hub (real-time push to browser) │
│          ├── Web Push (VAPID background alerts)  │
│          └── Drizzle ORM (migrations, queries)   │
│                                                 │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌──────────────────┐     ┌────────────────────────┐
│  MySQL / MariaDB │     │  Traeger MQTT Broker    │
│  (your instance) │     │  (mqtt.traeger.com)     │
└──────────────────┘     └────────────────────────┘
```

---

## Database Schema

The application manages 14 tables across four domains:

**Authentication** (managed by Better Auth): `user`, `session`, `account`, `verification`

**Grill Data**: `traeger_sessions` (encrypted Traeger credentials), `telemetry_readings` (temperature/state snapshots), `cook_sessions` (cook history), `cook_alerts` (temperature alerts), `pellet_logs` (pellet consumption)

**Automation**: `automation_programs` (multi-step cook programs), `custom_templates` (reusable program templates), `program_executions` (execution history)

**Access Control**: `invite_codes`, `email_allowlist`, `app_settings`

**Notifications**: `push_subscriptions` (Web Push endpoints), `notification_preferences` (per-user alert toggles)

Migrations are applied automatically on startup via Drizzle. Migration files are in `drizzle/`.

---

## Building Locally

```bash
git clone https://github.com/jacobj/traeger-smoker-insight.git
cd traeger-smoker-insight

# Build the Docker image
docker build -t traeger-smoker-insight:local .

# Or run in development mode (requires Node.js 22+)
pnpm install
pnpm dev
```

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (Express + Vite HMR)
pnpm dev

# Run tests (335 tests across 13 files)
pnpm test

# Type check
npx tsc --noEmit

# Build for production
pnpm run build

# Generate a new Drizzle migration after schema changes
pnpm drizzle-kit generate
```

### Project Structure

```
client/src/
  pages/           Dashboard, LiveCook, History, Analytics, CookPrograms,
                   Controls, Settings, AdminSettings, Login, Register
  components/      DashboardLayout, CookConfigurator, shadcn/ui
  lib/             tRPC client, auth client, utilities

server/
  routers/         tRPC procedures (admin, analytics, automation, cook-session,
                   executions, grill, live-cook, templates, traeger)
  db/              Drizzle query helpers (access-control, analytics, cook-sessions,
                   executions, pellet, telemetry, templates, traeger-sessions)
  mqtt-manager.ts  Per-user MQTT connection lifecycle
  sse.ts           Server-Sent Events hub
  web-push.ts      VAPID key management and push delivery
  crypto.ts        AES-256-GCM encryption for stored tokens
  _core/           Framework plumbing (auth, context, vite bridge)

drizzle/           Schema and migration SQL files
shared/            Types and constants shared between client and server
root/              s6-overlay service definitions
```

---

## Security

Traeger account credentials entered through the Settings UI are encrypted with AES-256-GCM before storage in the database. The encryption key is derived from `JWT_SECRET`. Credentials are only decrypted server-side when establishing MQTT connections.

Registration is **closed by default**. The admin must explicitly open registration or distribute invite codes. Available registration modes:

| Mode | Description |
|------|-------------|
| `closed` | No new registrations allowed |
| `invite` | Users must provide a valid invite code |
| `allowlist` | Only pre-approved email addresses can register |
| `open` | Anyone can register |

---

## Reverse Proxy Configuration

When running behind a reverse proxy, set `BETTER_AUTH_URL` to your external URL. Example configurations:

**Traefik** (docker labels):
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.traeger.rule=Host(`grill.example.com`)"
  - "traefik.http.services.traeger.loadbalancer.server.port=8420"
```

**Nginx Proxy Manager**: Point a proxy host to `traeger-smoker-insight:8420` with WebSocket support enabled (required for SSE).

**SWAG / Nginx**:
```nginx
location / {
    proxy_pass http://traeger-smoker-insight:8420;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;  # Required for SSE
}
```

---

## Health Monitoring

The application exposes three operational endpoints that require no authentication:

| Endpoint | Purpose |
|----------|--------|
| `GET /api/health` | Returns 200 if the app is ready (DB connected, VAPID initialized), 503 if degraded. Includes memory stats. Used by Docker HEALTHCHECK and reverse proxy probes. |
| `GET /api/metrics` | Returns runtime metrics: active MQTT sessions, SSE client count, active alarms, heap usage, uptime. |
| `GET /api/version` | Returns build metadata: version, Node.js version, PID, startup timestamp. |

The Docker image includes a `HEALTHCHECK` instruction that pings `/api/health` every 30 seconds. Docker Compose, Swarm, and Kubernetes will automatically restart unhealthy containers.

---

## Rate Limiting

All API endpoints are rate-limited per IP address to prevent brute-force attacks and abuse:

| Endpoint | Limit | Purpose |
|----------|-------|--------|
| `/api/auth/*` | 20 req/min | Better Auth sign-in, sign-up, session |
| `/api/trpc/traeger.connect` | 5 req/min | Traeger credential exchange (strictest) |
| `/api/trpc/admin.*` | 30 req/min | Admin operations |
| `/api/trpc/*` | 200 req/min | All other tRPC procedures |

Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are included in all responses per the IETF draft standard. When a limit is exceeded, the server returns `429 Too Many Requests` with a JSON error body.

For deployments behind a reverse proxy, `trust proxy` is enabled so rate limiting uses `X-Forwarded-For` instead of the proxy's IP.

---

## Log Aggregation

In production, the application outputs structured JSON logs via [pino](https://getpino.io/) to stdout. Each log line includes a timestamp, level, module name, and contextual fields (userId, grillId, etc.). Sensitive fields (passwords, tokens, VAPID keys) are automatically redacted.

An optional Grafana + Loki + Promtail stack is included for log aggregation and visualization:

```bash
# Start with log aggregation
docker compose -f docker-compose.yml -f docker-compose.logging.yml up -d
```

This adds three containers:

| Service | Port | Purpose |
|---------|------|--------|
| Grafana | 3100 | Log visualization dashboard |
| Loki | (internal) | Log storage and query engine |
| Promtail | (internal) | Collects Docker container logs |

Grafana is pre-configured with Loki as the default data source. Default credentials are `admin`/`admin` (change on first login).

Example LogQL queries in Grafana:

```logql
# All MQTT module logs
{container_name="traeger-smoker-insight"} | json | module="mqtt"

# All errors
{container_name="traeger-smoker-insight"} | json | level="error"

# Alarm events
{container_name="traeger-smoker-insight"} | json | module="alarm"

# Error rate over 5 minutes
rate({container_name="traeger-smoker-insight"} | json | level="error" [5m])
```

If you already have a log aggregation stack (Datadog, ELK, etc.), simply collect stdout from the `traeger-smoker-insight` container. The JSON format is compatible with any pino-aware log parser.

---

## Versions

| Date | Description |
|------|-------------|
| 2025-04-07 | Enterprise hardening: structured logging (pino), health/metrics/version endpoints, graceful shutdown, rate limiting, input validation bounds, lazy loading, Docker HEALTHCHECK, stale session reaper, telemetry purge, 4 new DB indexes, log aggregation stack |
| 2025-04-06 | Initial release: live monitoring, cook sessions, pellet tracking, cook programs, multi-grill, admin panel, Better Auth, Web Push notifications, Docker/LSIO |

---

## License

MIT
