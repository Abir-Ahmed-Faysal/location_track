# Configuration reference

## Server environment

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | yes | PostgreSQL connection string; Docker API uses `postgres:5432` internally |
| `PORT` | yes | HTTP port, normally `3000` |
| `NODE_ENV` | yes | `development`, `test`, or `production` |
| `ACCESS_TOKEN_SECRET` | yes | JWT access-token secret, minimum 32 characters |
| `REFRESH_TOKEN_SECRET` | yes | JWT refresh-token secret, minimum 32 characters |
| `ACCESS_TOKEN_EXPIRES_IN` | yes | Access-token lifetime, e.g. `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | yes | Refresh-token lifetime, e.g. `7d` |
| `FRONTEND_URL` | no | Legacy single CORS origin; use `FRONTEND_URLS` for production |
| `FRONTEND_URLS` | production yes | Comma-separated exact trusted frontend origins; production requires HTTPS |
| `ADMIN_EMAIL` | no | Optional initial admin account email; requires `ADMIN_PASSWORD`; if this email already exists, startup leaves it unchanged |
| `ADMIN_PASSWORD` | no | Optional initial admin password (8–72 characters); hashed before insert and never logged |
| `RATE_LIMIT_PER_MINUTE` | no | Per-IP and per-device in-memory request limit; defaults to `60` |
| `PROMETHEUS_ENABLED` | no | Expose `/metrics` for Prometheus scraping; defaults to `false` |

## Location quality

- Freshness: `<=15s` is **Fresh**, `15â€“60s` is **Delayed**, and `>60s` is **Stale**.
- Accuracy: `<=25m` is **Good**, `25â€“50m` is **Reduced**, and `>50m` is **Poor**.
- Coordinates must be finite and within latitude `[-90, 90]` and longitude `[-180, 180]`.
- Speed must be non-negative and bearing must be in `[0, 360)`.

## Batch and pagination limits

- Supported schema version: `1`.
- A batch contains at most five events.
- History `limit` accepts `1..200`, defaulting to `50`.
- Event IDs are unique and retries are classified as duplicates.

## Android profiles

| Profile | Interval | Minimum displacement |
|---|---:|---:|
| Active | 5 seconds | 5m |
| Balanced | 10 seconds | 10m |
| Stationary | 60 seconds | 25m |

The SDK scaffold allows a host application to provide its own queue and uploader
adapters while keeping these contracts stable.

Production-specific validation and deployment requirements are documented in the
[production deployment checklist](production-deployment.md).
