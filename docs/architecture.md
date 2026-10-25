# Architecture overview

```text
Android host app
      |
      | LocationEvent queue + BatchUploader
      v
POST /api/v1/locations/batch
      |
      +--> AuthAdapter / owner boundary
      +--> Core validation and idempotency
      +--> Prisma transaction
              +--> PostgreSQL LocationEvent
              +--> PostGIS geography(Point,4326)
              +--> LatestLocation read model
      |
      +--> labackend/test/history APIs

Docker Compose
  API container  --->  PostGIS container
```

## Layers

- `backend/src/core/` contains framework-independent validation, freshness, accuracy,
  ordering, and adapter ports.
- `backend/src/modules/` contains NestJS HTTP adapters for authentication, devices,
  locations, and health checks.
- `backend/prisma/` contains relational migrations; the location point is maintained as
  a PostGIS geography column through raw migration SQL.
- `android/` contains the host-neutral Kotlin engine, queue contract,
  uploader contract, and retry policy.

## Persistence invariant

An event is acknowledged only after the database transaction commits. Event IDs are
unique, so retries are safe. `LatestLocation` is updated only when the incoming
`capturedAt` is newer than the materialized value; old replays remain in history but
cannot move the latest read model backwards.

## Security boundary

Authentication runs before location access. Device and location queries are scoped to
the authenticated owner and return `404` for inaccessible resources to avoid leaking
cross-context existence. Error responses contain request IDs but never tokens or
precise coordinates.

Realtime fan-out and operational metrics are planned for a later phase and are not
required for the persistence path.
