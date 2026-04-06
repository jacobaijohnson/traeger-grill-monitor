# Environment Variables Template

Copy these into a `.env` file when deploying via Docker.

## LinuxServer.io Standard Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | `1000` | User ID for file permissions (run `id -u` on your host) |
| `PGID` | `1000` | Group ID for file permissions (run `id -g` on your host) |
| `TZ` | `America/Los_Angeles` | Timezone ([list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL / TiDB connection string | `mysql://traeger:pass@mysql:3306/traeger_dashboard` |
| `JWT_SECRET` | Secret for signing JWT session cookies | Random 64-char string |

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CONFIG_PATH` | `./config` | Host path for persistent config volume |
| `MYSQL_ROOT_PASSWORD` | `rootpass` | Root password for bundled MySQL |
| `MYSQL_PASSWORD` | `traeger_pass` | User password for bundled MySQL |

## Notes

- Traeger account credentials are entered through the app UI (Settings page)
- No Traeger API keys are needed — authentication uses Traeger's public Cognito flow
- MQTT connections to Traeger's IoT broker are established per-user at runtime
- All external API endpoints are public Traeger/AWS services
- The Manus OAuth system is not needed for self-hosted Docker deployments
- The `/config` volume stores persistent application data
- PUID/PGID ensure correct file ownership on NAS systems (Synology, Unraid, TrueNAS)
