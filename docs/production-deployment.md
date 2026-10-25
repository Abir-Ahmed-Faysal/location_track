# Production deployment checklist

This project does not deploy infrastructure, change DNS, or create paid
resources. The operator must provide the PostgreSQL/PostGIS service, secret
manager, domain, certificates, and reverse proxy.

## Required environment

Use [backend/.env.production.example](../backend/.env.production.example) as a placeholder-only
template. Inject the filled values through a secret manager or the deployment
platform, not source control. Required values are `DATABASE_URL`, `PORT`,
`NODE_ENV=production`, both JWT secrets, token lifetimes, and `FRONTEND_URLS`.
`DATABASE_URL` must be a PostgreSQL URL for a PostGIS-enabled database; the
application never supplies database credentials. Production validation rejects
local/default database targets, weak/reused JWT secrets, missing explicit HTTPS
origins, invalid ports, and non-PostgreSQL URLs before Nest starts.

Generate secrets locally with a CSPRNG and do not paste them into tickets,
logs, documentation, or Git:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

## Domain, HTTPS, WSS, and reverse proxy

1. Point the API hostname (for example `api.example.com`) to the chosen HTTPS
   reverse proxy. DNS changes are intentionally outside this repository.
2. Terminate TLS at the proxy using a certificate from the organization's CA or
   ACME process. Redirect HTTP to HTTPS and allow only TLS 1.2+.
3. Proxy `/api/` and `/health` to the API container over the private network.
4. Proxy the Socket.IO namespace `/ws/v1/locations` with HTTP/1.1 upgrade
   headers (`Upgrade` and `Connection: upgrade`) so WSS works. Keep idle/read
   timeouts longer than the expected connection lifetime.
5. Restrict `/metrics` to the monitoring network or proxy authentication. Set
   `PROMETHEUS_ENABLED=true` only when this access is controlled.
6. Set `FRONTEND_URLS` to a comma-separated allowlist of exact HTTPS origins;
   do not use `*` with credentials.

Example Nginx shape (adapt paths, certificates, and upstream names):

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;
  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  location / { proxy_pass http://location-api:3000; proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /ws/v1/locations {
    proxy_pass http://location-api:3000/ws/v1/locations;
    proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade"; proxy_read_timeout 3600s;
  }
}
```

## Database access, backups, and restore verification

- Use a managed/private PostgreSQL service with PostGIS enabled and TLS in
  transit (`sslmode=require` or the provider equivalent).
- Give the runtime role only the schema privileges needed for migrations and
  normal reads/writes; keep backup/restore credentials separate.
- Permit database access only from the API and backup networks. Do not expose
  PostgreSQL publicly or commit credentials.
- Run encrypted automated backups (daily full plus provider/WAL point-in-time
  recovery where available). Keep at least 7 daily, 4 weekly, and 12 monthly
  copies, subject to the organization's retention policy.
- Monitor backup success, age, storage encryption, and access audit logs.
- At least monthly, restore a backup into an isolated PostGIS database, verify
  `postgis_full_version()`, apply migrations, run health and representative
  location-ingestion checks, and record the restore duration and result.

Example logical backup shape (run through the approved secret mechanism):

```bash
pg_dump --format=custom --no-owner --file=locationtrack-$(date +%F).dump "$DATABASE_URL"
pg_restore --list locationtrack-YYYY-MM-DD.dump
```

Never run restore commands against production without an approved change and a
verified target. This repository does not execute backups or destructive restore
operations automatically.

## Pre-release checklist

- [ ] Production values injected from secret manager; no secrets in Git/logs.
- [ ] `DATABASE_URL` points to private TLS PostgreSQL/PostGIS.
- [ ] PostGIS extension and migrations verified in a staging clone.
- [ ] JWT secrets are distinct, high entropy, and rotated procedure exists.
- [ ] Exact HTTPS `FRONTEND_URLS` tested; unexpected Origin is rejected.
- [ ] HTTPS redirect, WSS upgrade, proxy timeouts, and forwarding headers tested.
- [ ] `/api/v1/health/live` and `/api/v1/health/ready` monitored.
- [ ] Backups encrypted, retained, access-controlled, and restore-tested.
- [ ] Metrics endpoint disabled or restricted to the monitoring network.
- [ ] Rollback image and database migration procedure approved.
