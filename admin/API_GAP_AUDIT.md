# Admin dashboard API and authorization gap audit

Date: 2026-10-25

## Verified existing contracts

| Capability | Existing route/protocol | Current behavior |
|---|---|---|
| Sign in | `POST /api/v1/auth/login` | Normal user email/password login; sets HttpOnly access/refresh cookies and returns auth result |
| Current user | `GET /api/v1/auth/profile` | Authenticated profile only; does not expose an authorization role |
| Device read | `GET /api/v1/devices/:id` | Authenticated and owner-scoped; there is no device collection/list route |
| Latest location | `GET /api/v1/locations/latest?deviceId=...` | Authenticated and owner-scoped; one device at a time |
| Location history | `GET /api/v1/locations/history?deviceId=...&limit=...&cursor=...` | Authenticated and owner-scoped; bounded cursor pagination, no date-range filters |
| App metrics | `GET /api/v1/metrics` | Authenticated in-process ingestion counters and latency only; no fleet/device overview |
| Realtime | Socket.IO namespace `/ws/v1/locations` | Handshake `auth.token`; `subscribe` with `{ deviceId }`; `location.updated` event; subscription is owner-scoped to one device |

The Prisma `User` model has no role field. The current backend does not provide an administrator authorization boundary or API to enumerate all authorized users' devices. The regular user endpoints cannot securely power the requested all-user admin dashboard.

## Admin model selected

The requested target is a database-backed admin role. Provisioning should be controlled outside public signup (for example, a reviewed migration/operations command assigning the role to a designated account). Public signup must never grant admin access. The frontend will treat role information as a display aid; every protected API and realtime subscription must enforce the role on the server.

## Minimum backend work required before real dashboard data integration

1. Add a database-backed role/permission field and migration with a safe default of ordinary user. Add an `AdminGuard` (or equivalent) that verifies the signed-in account's current database role rather than trusting a client claim.
2. Add administrator-only, read-only APIs:
   - `GET /api/v1/admin/overview` for counts only where the data supports them, with documented freshness threshold.
   - `GET /api/v1/admin/devices` with bounded pagination and server-side search; return only approved device and owner summary fields plus latest-location data when present.
   - `GET /api/v1/admin/devices/:deviceId` for authorized device details.
   - `GET /api/v1/admin/devices/:deviceId/locations/history` with bounded cursor pagination and optional `from`/`to` filters.
3. Extend the existing realtime authorization for administrators to subscribe only to enumerated active devices, preserving the existing `auth.token`, `subscribe` and `location.updated` protocol. If safe fleet subscriptions require a new message contract, document that contract before implementing it.
4. Ensure unauthorized/ordinary users receive 403 (or the project's documented error envelope) for admin routes and cannot enumerate devices by guessing IDs. Keep current owner-scoped APIs unchanged.
5. Add integration coverage for admin success, regular-user denial, cross-owner isolation, pagination/date filters, and realtime authorization.

No backend implementation is included in this audit. This follows the dashboard task's instruction to request approval before changing backend authorization or contracts.

## Frontend implementation boundary

Until the backend work above is approved and available, the admin app can have its package scaffold and non-sensitive layout, but cannot truthfully provide protected fleet totals, all-device map/table data, admin login authorization, or fleet realtime updates. It must not call regular-user routes as an admin workaround, invent admin endpoints, or show fabricated data.
