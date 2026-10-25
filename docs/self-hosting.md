# Self-hosting guide

## Requirements

- Docker Desktop with Linux containers enabled
- At least 2 GB available memory for the PostGIS image

## Start locally

Copy `backend/.env.example` to `backend/.env` and replace both token secrets with values of at least
32 characters. Then start the stack:

```bash
docker compose -f backend/docker-compose.yml up --build -d
docker compose -f backend/docker-compose.yml ps
```

The API is available at `http://localhost:3000`; PostGIS is exposed on host port
`5433`. The API container runs `prisma migrate deploy` before starting. This
Compose file is for local use; production must inject an external TLS
`DATABASE_URL` and must not use the example database credentials.

For an external production PostgreSQL/PostGIS service, use the production
override after creating an untracked `backend/.env.production` from the placeholder
template:

```bash
docker compose -f backend/docker-compose.production.yml up --build -d
```

That file does not define a database, user, password, or DNS record; all values
come from the injected environment.

## Health and logs

```bash
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
docker compose -f backend/docker-compose.yml logs -f api
```

## Backup and restore

Create a logical backup from the PostGIS container:

```bash
docker compose -f backend/docker-compose.yml exec -T postgres pg_dump -U postgres -d locationtrack > locationtrack.sql
```

Restore into the running database (for a disposable/local environment):

```bash
cat locationtrack.sql | docker compose -f backend/docker-compose.yml exec -T postgres psql -U postgres -d locationtrack
```

For production, store encrypted backups outside the Docker volume, restrict
backup access, define retention (for example 7 daily/4 weekly/12 monthly), and
restore into an isolated PostGIS database at least monthly. Verify the PostGIS
extension, migrations, health checks, and a representative ingestion before
relying on a backup. See the [production checklist](production-deployment.md).

## Stop and update

```bash
docker compose -f backend/docker-compose.yml down
docker compose -f backend/docker-compose.yml up --build -d
```

`docker compose -f backend/docker-compose.yml down` preserves the named database volume. Do not use
`docker compose -f backend/docker-compose.yml down -v` unless the database is intentionally disposable.
