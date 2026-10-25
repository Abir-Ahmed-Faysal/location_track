# Admin dashboard implementation plan

## Current implementation state

The selected database-backed admin role and the required read-only API/realtime authorization changes were approved by the user and are implemented in the working tree. The frontend routes are implemented and the admin production build and frontend tests pass. The remaining release gate is a database-backed admin API e2e run and applying the migration in the target environment; see [API_GAP_AUDIT.md](API_GAP_AUDIT.md).

## Goal

Build an administrator-facing web application that displays real device and location data from the existing Universal Location Engine. The dashboard is read-only for the initial release: no remote device controls, credential changes, or destructive operations.

## Repository layout

- `admin/` — new web dashboard application.
- `backend/` — NestJS API, PostGIS/Prisma schema and migrations, tests, scripts, monitoring assets, and Docker files.
- `android/` — Kotlin SDK library and demo app.

The repository is organized into these three top-level application folders. Shared documentation and the pnpm workspace configuration remain at the repository root.

## Proposed admin technology

- React + TypeScript + Vite for the web app.
- React Router for dashboard routes.
- TanStack Query for REST caching, refresh, cancellation, and loading/error states.
- MapLibre GL JS for interactive WebGL maps, clustered markers, history lines, and map style switching.
- MapTiler Hybrid/Satellite as an optional imagery provider; OpenFreeMap as an optional street-map style. Keep style URLs configurable. Preserve provider attribution and usage terms. Browser-visible map keys must be restricted public keys, never server secrets.
- Socket.IO client only after confirming the backend's exact authentication handshake, subscription message, and event format.

## Stage 1 — API and security audit (blocking gate)

Before implementing protected screens, inspect the actual auth, device, location, metrics, and realtime contracts and record routes, payload schemas, pagination, and event names. Do not invent APIs or infer role privileges from frontend state.

The existing backend appears to provide ordinary authenticated accounts and owner-scoped device access. Confirm whether an administrator role and authorized cross-owner read access exist. If not, stop protected all-user dashboard integration and document the smallest backend authorization/API change needed. Obtain approval before changing backend authorization or exposing cross-owner location data. Never use device credentials as administrator credentials.

## Stage 2 — App foundation and API client

Create the app under `admin/` using existing repository package-manager conventions. Add typed API services for authentication, devices, latest locations, history, and only those statistics the backend actually exposes. Use the actual API prefix and response envelopes. Centralize session expiry, 401/403 handling, request cancellation, and errors. Configure the API URL through an example environment file with placeholders only.

## Stage 3 — Dashboard and device views

Implement protected routes:

- `/login`
- `/admin` overview
- `/admin/map`
- `/admin/devices`
- `/admin/devices/:deviceId`
- `/admin/devices/:deviceId/history`

Build responsive navigation, summary cards, searchable/sortable/paginated device table, device detail view, and bounded history table. Show only fields returned by authorized APIs. Do not fabricate totals or connectivity diagnostics. Distinguish device capture time, server receipt time, and dashboard refresh time.

## Stage 4 — Map and realtime

Show one valid latest-location feature per authorized device. Provide marker selection, device search/filter, fit/center, zoom/pan, and a Street/Satellite/Hybrid style selector when configured. Show available device ID/name, last-seen, coordinates, accuracy, and timestamps in a popup or side panel.

Use the existing authenticated Socket.IO protocol only after contract verification. Clean up listeners on unmount. Use bounded periodic REST refresh as fallback and prevent duplicate polling. Show connection/refresh state; a WebSocket disconnect does not mean a device is offline.

Location history can be plotted chronologically as recorded points with an optional connecting line. Label the line as recorded samples, not the exact travelled route. Never fetch unbounded history.

## Movement state rules

Display movement state separately from connectivity and data freshness:

- `Moving`: supported by a valid device speed reading above a documented threshold or multiple reliable fixes showing meaningful displacement.
- `Stationary`: at least two valid, sufficiently accurate fixes remain within a documented distance tolerance for a documented minimum duration.
- `Unknown`: missing speed and insufficient/reliably unusable fixes.
- `Stale`: no sufficiently recent location update; stale is data freshness, not proof the device is offline.

A single `speed = 0` reading or unchanged rounded coordinate is not sufficient to conclude stationary. Account for reported accuracy/GPS jitter. Do not infer human activities such as waiting, talking, or “gossiping.” If duration is shown, derive it from qualifying location history and label it, e.g. “Stationary ~12 min.”

## Stage 5 — Tests, documentation, and acceptance

Use the selected frontend test framework and test API parsing, auth failures, loading/error/empty states, device search/pagination, coordinate validation, freshness/movement classification, history filtering, map features, WebSocket cleanup, and REST fallback. Mock data is allowed in tests only; production UI reads the real backend.

Document setup, environment values, administrator provisioning, actual endpoints, map attribution/provider configuration, HTTPS/WSS deployment, and known backend gaps. Run the admin build and relevant tests and record exact results.

## Definition of done

- Admin app builds and required tests pass.
- Only an authorized administrator can access cross-owner data; backend authorization enforces this.
- Real device and persisted location data appear in both table and map.
- History queries are bounded and follow backend pagination.
- Realtime and REST fallback use verified contracts and clean up correctly.
- Missing data, stale data, unknown movement, and errors are represented honestly.
- No production mock data, exposed server secrets, or unsupported activity claims.
- Remaining API gaps, environment variables, changed files, routes, and test results are documented.
