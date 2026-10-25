# Universal Location Engine Admin

Read-only administrator dashboard built with React, TypeScript, Vite, TanStack Query, MapLibre GL JS, and Socket.IO.

## Run locally

1. Install dependencies: `pnpm --dir admin install`.
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` if the backend is not at `http://localhost:3000/api/v1`.
3. Start PostgreSQL and apply migrations with `pnpm --dir backend exec prisma migrate deploy`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`, and include `http://localhost:3001` in the backend `FRONTEND_URLS` allowlist.
4. Start the dashboard: `pnpm --dir admin dev` and open `http://localhost:3001`.

The browser uses the backend's HttpOnly `access_token` and `refresh_token` cookies. The access token returned in the login response is not stored in browser storage. Admin APIs and realtime subscriptions verify the database role on the server.

## Administrator provisioning

Public signup always creates an ordinary `USER`. To create the first admin automatically, apply the Prisma migration and set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` (or the deployment secret environment) before starting the API. The password must be 8–72 characters and is bcrypt-hashed before it is stored. Startup uses an atomic insert that skips duplicate emails; an existing account is left untouched and is never silently promoted. Remove the bootstrap password from the deployment environment after the initial account has been created.

If the configured email already belongs to a regular account, or if you need to promote an account created earlier, use a controlled database session:

```sql
UPDATE "User"
SET "role" = 'ADMIN'::"UserRole"
WHERE "email" = 'admin@example.com';
```

Verify that exactly the intended account was changed. Do not enable or expose a public admin bootstrap endpoint. The role is checked against the database for each protected admin request and each realtime device subscription.

## Features

- `/login`: normal account sign-in; the backend rejects non-admin access to fleet data.
- `/admin`: persisted fleet counts, recent heartbeat count, latest saved location activity, and refresh status.
- `/admin/devices`: server-side search, status filter, and bounded pagination.
- `/admin/devices/:deviceId`: device, owner, latest location, capture/receipt times, accuracy, and movement evidence.
- `/admin/devices/:deviceId/history`: date-filtered, cursor-paginated location events.
- `/admin/map`: latest valid location per device with 100 devices per page, map pagination, selection, freshness coloring, Street/Satellite/Hybrid styles, Socket.IO updates, and 30-second REST fallback.

The map uses 100 devices per page because that is the API's maximum page size; the map pager covers the full fleet. “Recently active” is a five-minute server heartbeat count, not a location freshness or human activity claim. A movement label needs a current fix (no older than 60 seconds); a stationary label also requires at least two accurate fixes spanning five minutes. Zero speed alone remains unknown. Location samples are not presented as an exact travel route.

## API contracts used

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout-all`
- `GET /api/v1/admin/overview`
- `GET /api/v1/admin/devices?page=&limit=&search=&status=`
- `GET /api/v1/admin/devices/:deviceId`
- `GET /api/v1/admin/devices/:deviceId/locations/history?limit=&cursor=&from=&to=`
- Socket.IO namespace `/ws/v1/locations`; cookie-authenticated `subscribe` with `{ "deviceId": "…" }`; event `location.updated`.

## Map styles and attribution

OpenFreeMap Liberty is the default street style and needs no browser key. MapTiler Satellite and Hybrid require a **public browser key** in `VITE_MAPTILER_KEY`; restrict the key to the deployed dashboard origins and only the needed map APIs. Never put a server secret in a `VITE_` variable. MapLibre displays style-provided attribution, and the map also identifies OpenStreetMap contributors and OpenFreeMap.

The Maps URLs use MapTiler's documented MapLibre style endpoint and its satellite/hybrid map IDs: [MapTiler MapLibre guide](https://docs.maptiler.com/maplibre/), [Satellite dataset](https://docs.maptiler.com/schema-raster/satellite/).

## Deployment notes

- Serve the dashboard and API over HTTPS; the socket connection then uses WSS.
- Set `FRONTEND_URLS` to the exact dashboard origin(s). Keep API and dashboard on the same site so the backend's `SameSite=Lax` auth cookies are sent.
- Configure `VITE_API_BASE_URL` and an origin-restricted public MapTiler key at build time.
- Deploy database migrations with `pnpm --dir backend exec prisma migrate deploy` before starting the admin app. The new authorization migration must be applied before the generated Prisma client is used by the API.

## Verification

Run `pnpm --dir admin build` and `pnpm --dir admin test`. Backend admin authorization/e2e checks and database migration results are tracked in [API_GAP_AUDIT.md](API_GAP_AUDIT.md).
