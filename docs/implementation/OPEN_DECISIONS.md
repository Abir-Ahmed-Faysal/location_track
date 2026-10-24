# Universal Location Engine — Open Decisions

> Decisions that need owner/team input. Defaults are provided so development is not blocked.

---

| # | Decision | Default for Development | Blocks |
|---|---|---|---|
| OD-1 | **Migration reset** — existing User/Session schema is for email/password auth, not ULE. Reset to clean schema? | ✅ Reset (no production data exists) | Phase 2 |
| OD-2 | **Auth provider** — which identity provider for production? Current code has JWT email/password. | Use existing JWT as adapter for dev; production provider TBD | Production only |
| OD-3 | **Device identity model** — how are devices identified and enrolled in the adopting app? | API key or token-based registration via `/devices/register` | Phase 2 |
| OD-4 | **Data retention period** — how long to keep location history? | No auto-delete in v1; retention module is Phase 6 optional | Phase 6 |
| OD-5 | **Hosting environment** — where will production run? | Docker Compose for local/self-hosted | Production only |
| OD-6 | **Map provider for demo/console** — Leaflet+OSM, Google Maps, Mapbox? | Leaflet + OpenStreetMap (free, no API key) | Phase 6 (if admin UI built) |
| OD-7 | **Android min/target SDK** — minimum Android version to support? | minSdk 26 (Android 8.0), target latest stable | Phase 3 |
| OD-8 | **Scale target confirmation** — 1,000 concurrent devices, is this correct? | Yes, per PRD §10.1 | Phase 4 (load test) |
| OD-9 | **Cross-context isolation model** — per-deployment isolation or shared-DB namespace? | Per-deployment (simplest for self-hosted) | Phase 2 |
| OD-10 | **Realtime transport** — Socket.IO, raw WebSocket, or SSE? | Socket.IO via `@nestjs/websockets` (broadest client support) | Phase 4 |

---

## Resolution Log

| # | Resolved | Decision | By |
|---|---|---|---|
| — | — | — | — |

_(To be filled as decisions are made)_
