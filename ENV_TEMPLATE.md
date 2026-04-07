# Environment Variables

Copy these into a `.env` file next to your `docker-compose.yml`.

## LinuxServer.io Standard Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | `1000` | User ID for file permissions (run `id -u` on your host) |
| `PGID` | `1000` | Group ID for file permissions (run `id -g` on your host) |
| `TZ` | `America/Los_Angeles` | Timezone ([list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL / MariaDB connection string | `mysql://traeger:pass@mysql:3306/traeger_dashboard` |
| `JWT_SECRET` | Secret for signing session cookies (random 64-char string) | `openssl rand -hex 32` |

## Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `BETTER_AUTH_URL` | `http://localhost:8420` | Public URL of the app. Set this when behind a reverse proxy (e.g., `https://grill.example.com`) |
| `ADMIN_EMAIL` | _(none)_ | Email for the bootstrap admin account. Created on first boot. |
| `ADMIN_PASSWORD` | _(none)_ | Password for the bootstrap admin account (min 8 chars). |

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8420` | Internal container port (rarely needs changing) |
| `TUNNEL_TOKEN` | _(none)_ | Cloudflare Tunnel token. Enables outbound-only tunnel to Cloudflare's edge. See README for setup. |
| `CONFIG_PATH` | `./config` | Host path for persistent config volume |
| `MYSQL_ROOT_PASSWORD` | `rootpass` | Root password for bundled MySQL |
| `MYSQL_PASSWORD` | `traeger_pass` | User password for bundled MySQL |

## Example `.env` File

```env
# Required
JWT_SECRET=your-random-64-char-string-here
BETTER_AUTH_URL=http://192.168.1.100:8420

# Admin bootstrap (remove after first login)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password

# LSIO standard
PUID=1000
PGID=1000
TZ=America/New_York

# MySQL (if using bundled service)
MYSQL_ROOT_PASSWORD=change-me
MYSQL_PASSWORD=change-me-too

# Cloudflare Tunnel (optional — omit to disable)
# TUNNEL_TOKEN=eyJhIjoiYWJj...
```

## Notes

- **Port 8420** was chosen because it is IANA-unassigned and does not conflict with common homelab services (Plex, Sonarr, Radarr, Home Assistant, Grafana, Portainer, etc.)
- Traeger account credentials are entered through the app UI (Settings page), not via environment variables
- No Traeger API keys are needed — authentication uses Traeger's public Cognito flow
- MQTT connections to Traeger's IoT broker are established per-user at runtime
- The Manus OAuth system is **not** used for self-hosted Docker deployments
- The `/config` volume stores persistent application data
- `PUID`/`PGID` ensure correct file ownership on NAS systems (Synology, Unraid, TrueNAS)
- If using a reverse proxy (Traefik, SWAG, Nginx Proxy Manager), set `BETTER_AUTH_URL` to your external URL
- **`TUNNEL_TOKEN` is a sensitive credential** — prefer Docker secrets (`/run/secrets/tunnel_token`) over plain env vars. The container checks for the secret file first, then falls back to the env var. Never commit the token to version control.
