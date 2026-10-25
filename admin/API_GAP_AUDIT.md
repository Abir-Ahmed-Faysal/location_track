# Admin API and authorization implementation record

Updated: 2026-10-25

## Previous gaps and implementation

The original audit found owner-scoped device and location reads, no database role, no fleet list/overview endpoints, and owner-only realtime subscriptions. The user approved the database-backed admin role and the minimum backend work required to build an all-user dashboard.

The working tree now contains the following backend changes:

- `UserRole` enum with `USER` default and a migration adding `User.role`.
- `AdminGuard` queries the current database role on protected admin requests.
- Read-only `/api/v1/admin/overview`, device list/detail, and bounded cursor/date-filtered history endpoints.
- The authenticated profile response includes the current role for account display; authorization does not rely on that client response.
- Optional startup bootstrap reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`, atomically creates a hashed `ADMIN` user if that exact email is absent, and skips an existing email without changing its current role.
- Realtime `subscribe` checks the current role and active device record. An admin can subscribe only to a specific device ID after it has been returned from the authorized fleet list.
- HTTP cookie authentication is supported for the Socket.IO handshake with the configured trusted frontend origins.
- An admin API e2e test covers ordinary-user denial, admin fleet reads, owner summary, persisted latest speed, history date filters, and unauthenticated denial.

## Current contracts

| Capability | Contract | Behavior |
|---|---|---|
| Sign in | `POST /api/v1/auth/login` | Existing email/password; sets HttpOnly cookies and returns the user's basic profile |
| Current profile | `GET /api/v1/auth/profile` | Authenticated profile, now includes database role |
| Admin overview | `GET /api/v1/admin/overview` | Counts persisted devices, devices with a saved location, location events, five-minute heartbeat count, and newest saved update time |
| Device table | `GET /api/v1/admin/devices?page=&limit=&search=&status=` | Admin-only, server-side search and bounded offset page (limit ≤ 100); includes owner summary and latest saved fix |
| Device detail | `GET /api/v1/admin/devices/:deviceId` | Admin-only device summary and latest saved fix |
| Device history | `GET /api/v1/admin/devices/:deviceId/locations/history?limit=&cursor=&from=&to=` | Admin-only, bounded cursor page (limit ≤ 200), optional capture-time range |
| Realtime | Socket.IO `/ws/v1/locations` | Cookie or token-authenticated; `subscribe({deviceId})`; emits `location.updated`; server checks role and active device |

The HTTP API prefix is `/api/v1`. Standard users receive 403 from admin routes, and unauthenticated requests receive 401. Existing owner-scoped device and location routes remain in place.

## Verification state

- Frontend production TypeScript/Vite build: **PASS**.
- Frontend unit tests: **PASS**; 8 tests for cookie request behavior, authorization error handling, valid map coordinates, and movement evidence.
- Prisma client generation, schema validation, and backend build: **PASS**.
- Backend unit tests: **PASS**, 15 suites and 120 tests, including admin seeding behavior and realtime admin/owner subscription authorization.
- Admin API e2e test: **pending** because no PostgreSQL database was available; the working tree contains no realtime e2e test at this time.
- Applying the role migration to a deployment database: **pending**.
- Admin account provisioning: documented in [README.md](README.md); after migration and normal signup, promote only the selected account using a controlled database session. Public signup never assigns `ADMIN`.

Do not mark the admin dashboard fully production-ready until the pending backend checks pass and the migration is applied in the target environment. Physical device/map-tile verification and production origin/cookie settings also remain environment-specific.
