# Universal Location Engine â€” Canonical Implementation Plan

> **This is the single source of truth for implementation.**
> The AI agent must read this file before starting any phase.
> Cross-reference with `STATUS.md` for current progress and `RULES.md` for constraints.

---

## 0. Repository Baseline (after Phase 0 audit)

### What exists and is preserved

| Component | Path | Status |
|---|---|---|
| NestJS 11 + TypeScript 5.7 | `backend/package.json`, `backend/tsconfig.json` | âœ… Keep |
| Prisma 7.8 + PrismaPg adapter | `backend/prisma/`, `backend/src/prisma/` | âœ… Keep â€” extend schema |
| ConfigModule + Zod validation | `backend/src/config/` | âœ… Keep â€” extend env vars |
| Global PrismaModule | `backend/src/prisma/prisma.module.ts` | âœ… Keep |
| ValidationPipe (global) | `backend/src/main.ts` | âœ… Keep |
| ESLint + Prettier | `backend/eslint.config.mjs`, `.prettierrc` | âœ… Keep |
| Auth module (email/password) | `backend/src/modules/auth/` | âš ï¸ Refactor into adapter pattern |
| Users module | `backend/src/modules/users/` | âš ï¸ Evaluate â€” may become part of identity adapter |
| AllExceptionsFilter | `backend/src/common/filters/` | âš ï¸ Rewrite to PRD error format |
| API prefix `api` | `backend/src/common/constants/` | âš ï¸ Change to `api/v1` |

### What was removed (Phase 0 cleanup)

| Component | Reason |
|---|---|
| `backend/src/modules/subscription/` | Out of scope â€” ULE is not a SaaS/newsletter product |
| `backend/src/modules/mail/` | Out of scope â€” no email sending needed |
| `Subscription` Prisma model | Out of scope |
| Mail env vars & config | No longer referenced |

---

## Phase 1 â€” Core Contracts

> **Goal:** Define the canonical event types, validation rules, domain interfaces/ports, idempotency contracts, ordering semantics, and quality/freshness types â€” all with unit tests. No HTTP, no database yet.

### 1.1 Deliverables

#### Domain types and contracts (`backend/src/core/domain/`)

| File | Purpose |
|---|---|
| `location-event.ts` | Canonical `LocationEvent` type matching PRD Â§6.2 |
| `location-event.schema.ts` | Zod validation: lat `[-90,90]`, lon `[-180,180]`, accuracy â‰¥0, speed â‰¥0, bearing `[0,360)`, timestamps, payload size |
| `freshness.ts` | Freshness classification: Fresh â‰¤15s, Delayed 15â€“60s, Stale >60s (configurable thresholds) |
| `accuracy.ts` | Accuracy classification: Good â‰¤25m, Reduced 25â€“50m, Poor >50m (configurable thresholds) |
| `tracking-profile.ts` | Profile definitions: Active (5s/5m), Balanced (10s/10m), Stationary (30â€“60s/15â€“25m), Custom |
| `event-ordering.ts` | Ordering semantics: sequence/captured_at-based, late/out-of-order handling |
| `idempotency.ts` | Idempotency key contract: `(event_id)` uniqueness, duplicate detection |
| `batch-result.ts` | Batch response type: `{ accepted[], duplicates[], rejected[], serverTime }` |
| `device-identity.ts` | Device identity type (stable `device_id` within integration ownership) |
| `clock-skew.ts` | Clock-skew policy: configurable tolerance window, uncertainty exposure |

#### Port interfaces (`backend/src/core/ports/`)

| File | Purpose |
|---|---|
| `event-store.port.ts` | Interface for persisting/querying location events |
| `latest-location.port.ts` | Interface for latest-location read model |
| `auth.port.ts` | Replaceable authentication adapter interface |
| `device-identity.port.ts` | Replaceable device identity adapter interface |
| `realtime-publisher.port.ts` | Interface for realtime event fan-out |
| `clock.port.ts` | Abstraction for current time (testable) |

#### Error types (`backend/src/core/errors/`)

| File | Purpose |
|---|---|
| `validation-error.ts` | Structured validation error with field-level details |
| `duplicate-event-error.ts` | Duplicate event detected |
| `unauthorized-error.ts` | Auth/authorization failure |
| `rate-limit-error.ts` | Rate limit exceeded with Retry-After |

### 1.2 Validation Rules (from PRD Â§6.2)

```
latitude:       [-90, 90], required, finite number
longitude:      [-180, 180], required, finite number
accuracy_m:     â‰¥ 0, optional (provider-reported)
captured_at:    valid ISO8601/RFC3339, required, clock-skew check
event_id:       valid UUID, required, unique per integration context
speed_mps:      â‰¥ 0, optional
bearing_deg:    [0, 360), optional
altitude_m:     finite number, optional
provider:       string enum or free-text, optional
batch size:     configurable max (default 5 events)
payload size:   configurable max
schema_version: must match supported version
```

### 1.3 Unit Tests

- Every validation rule has positive and negative test cases
- Freshness/accuracy classification tested at boundary values
- Idempotency key generation/comparison tested
- Clock-skew detection tested
- Batch result aggregation tested
- All port interfaces have type-level tests

### 1.4 Exit Gate

- [ ] All domain types compile and are exported
- [ ] All port interfaces defined with documentation
- [ ] All validation rules have passing unit tests
- [ ] Freshness/accuracy thresholds tested at boundaries
- [ ] No HTTP or database code introduced
- [ ] `pnpm test` passes

---

## Phase 2 â€” Backend Ingestion & Persistence

> **Goal:** Implement versioned API, durable writes, PostGIS migrations/indexes, latest-location reads, authentication boundaries, and API documentation.

### 2.1 Database Schema

#### New/modified Prisma models + raw SQL for PostGIS

| Table | Key Fields | Notes |
|---|---|---|
| `location_events` | id (UUID), event_id (UUID unique), device_id, captured_at, received_at, latitude, longitude, accuracy_m, altitude_m, speed_mps, bearing_deg, provider, is_mock, sequence, metadata | PostGIS `geography(Point,4326)` via raw SQL; composite indexes on `(device_id, captured_at)` |
| `latest_locations` | id, device_id (unique), event_id (FK), latitude, longitude, accuracy_m, captured_at, received_at, freshness_status | Materialized latest â€” updated atomically with ingest only when newer |
| `devices` | id (UUID), external_device_key (unique), platform, status, last_seen_at, created_at | Device registry for identity tracking |
| `idempotency_records` | id, scope, key, response_status, response_body, expires_at | `UNIQUE(scope, key)`; bounded TTL |

#### PostGIS setup

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
-- geography(Point,4326) columns added via raw migration SQL
-- GiST index on location_events.position
-- B-tree indexes on (device_id, captured_at), (event_id)
```

### 2.2 API Endpoints (under `/api/v1`)

| Method | Path | Purpose | Priority |
|---|---|---|---|
| `POST` | `/locations:batch` | Batch event ingestion | P0 |
| `GET` | `/locations/latest` | Latest location for a device | P0 |
| `GET` | `/locations/history` | Paginated history | P1 |
| `GET` | `/health/live` | Liveness probe | P0 |
| `GET` | `/health/ready` | Readiness probe (DB connected) | P0 |
| `POST` | `/devices/register` | Register a device | P0 |
| `GET` | `/devices/:id` | Get device info | P0 |

### 2.3 Ingestion Flow

```
POST /api/v1/locations:batch
  â”‚
  â”œâ”€â”€ 1. Authenticate request (auth adapter port)
  â”œâ”€â”€ 2. Validate batch: schema version, size limits, event count
  â”œâ”€â”€ 3. Validate each event: coordinates, timestamps, fields
  â”‚      â””â”€â”€ ANY invalid â†’ reject entire batch with structured errors
  â”œâ”€â”€ 4. DB Transaction:
  â”‚      â”œâ”€â”€ Check existing event_ids â†’ classify as duplicates
  â”‚      â”œâ”€â”€ INSERT new events (with PostGIS point)
  â”‚      â”œâ”€â”€ UPDATE latest_locations WHERE captured_at > existing
  â”‚      â””â”€â”€ COMMIT
  â”œâ”€â”€ 5. Fan-out to realtime publisher (async, non-blocking)
  â””â”€â”€ 6. Return { accepted[], duplicates[], rejected[], serverTime }
```

### 2.4 Authentication Adapter

- Define `AuthAdapter` interface matching `backend/src/core/ports/auth.port.ts`
- Implement `LocalAuthAdapter` using existing JWT auth as a starting adapter
- Auth is injected via NestJS DI â€” swappable per deployment
- Every endpoint validates auth before any data access

### 2.5 Error Response Format

All API errors return:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "requestId": "uuid",
    "details": [{ "field": "latitude", "reason": "must be between -90 and 90" }]
  }
}
```
Never return stack traces, secrets, or precise coordinates in errors.

### 2.6 Rate Limiting

- Configurable per-device and per-IP limits
- Returns `429` with `Retry-After` header
- Start with in-memory; document Redis migration path

### 2.7 Integration Tests

- Batch ingest: valid batch â†’ all accepted
- Batch ingest: duplicate event_ids â†’ classified as duplicates, no double-insert
- Batch ingest: invalid event in batch â†’ entire batch rejected
- Batch ingest: concurrent identical batches â†’ idempotent
- Latest location: updated only when captured_at is newer
- Latest location: old replay does NOT overwrite newer position
- Auth: unauthenticated request â†’ 401
- Auth: request for another integration's data â†’ 404 (not 403, no leaking)
- Health: /live returns 200, /ready returns 200 when DB connected
- PostGIS: spatial queries return correct results
- Rate limit: exceeding limit â†’ 429 with Retry-After

### 2.8 Exit Gate

- [ ] `prisma migrate dev` succeeds on fresh PostGIS database
- [ ] All P0 endpoints functional with integration tests passing
- [ ] Idempotent ingest proven under concurrent test
- [ ] Latest-location ordering proven (old event doesn't overwrite newer)
- [ ] Auth adapter swappable via configuration
- [ ] Error format matches PRD specification
- [ ] `pnpm test` and `pnpm test:e2e` pass

---

## Phase 3 â€” Android SDK

> **Goal:** Native Kotlin SDK with location capture, profiles, lifecycle/permissions, persistent queue, retries, acknowledgements, and diagnostics.

### 3.1 Project Structure

```
android/                    â† Reusable library module
â”œâ”€â”€ android-location/src/main/kotlin/.../ule/
â”‚   â”œâ”€â”€ UniversalLocationEngine.kt       â† Public API entry point
â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â””â”€â”€ TrackingConfig.kt            â† Profile configuration
â”‚   â”œâ”€â”€ capture/
â”‚   â”‚   â”œâ”€â”€ LocationCapturer.kt          â† Fused location provider adapter
â”‚   â”‚   â””â”€â”€ TrackingProfileManager.kt    â† Profile switching logic
â”‚   â”œâ”€â”€ queue/
â”‚   â”‚   â”œâ”€â”€ EventQueue.kt                â† Room-backed persistent queue
â”‚   â”‚   â”œâ”€â”€ QueueDiagnostics.kt          â† Depth, oldest age, failures
â”‚   â”‚   â””â”€â”€ QueuePolicy.kt              â† Size limits, exhaustion policy
â”‚   â”œâ”€â”€ sync/
â”‚   â”‚   â”œâ”€â”€ BatchUploader.kt             â† HTTPS batch upload
â”‚   â”‚   â”œâ”€â”€ RetryManager.kt              â† Exponential backoff + jitter
â”‚   â”‚   â”œâ”€â”€ AcknowledgementHandler.kt    â† Process server responses
â”‚   â”‚   â””â”€â”€ ConnectivityMonitor.kt       â† Network state changes
â”‚   â”œâ”€â”€ service/
â”‚   â”‚   â””â”€â”€ TrackingForegroundService.kt â† Android foreground service
â”‚   â”œâ”€â”€ permissions/
â”‚   â”‚   â””â”€â”€ PermissionManager.kt         â† Runtime permission checks
â”‚   â””â”€â”€ diagnostics/
â”‚       â””â”€â”€ EngineDiagnostics.kt         â† Status callbacks, metrics
â”‚
apps/android-sample/                     â† Minimal demo app
â”œâ”€â”€ MainActivity.kt
â””â”€â”€ TrackingDemoActivity.kt
```

### 3.2 SDK Public API

```kotlin
// Initialize
val engine = UniversalLocationEngine.Builder(context)
    .apiBaseUrl("https://your-server.com/api/v1")
    .authAdapter(yourAuthAdapter)
    .trackingProfile(TrackingProfile.BALANCED)
    .build()

// Control
engine.startTracking()
engine.stopTracking()
engine.requestFreshLocation()
engine.getDiagnostics()  // queue depth, oldest event, upload stats

// Callbacks
engine.setStatusListener { status -> /* TRACKING, STOPPED, PERMISSION_DENIED, QUEUE_FULL */ }
```

### 3.3 Offline Queue Invariants (PRD Â§6.3)

1. Persist to SQLite/Room **before** network upload
2. UUID event_id generated once â€” retries reuse same ID/payload
3. Remove from queue **only** after server `accepted` or `duplicate` ACK
4. Retry transient failures (5xx, 429, network) with exponential backoff + jitter
5. Permanent errors (4xx validation/auth) â†’ stop retrying that event, expose diagnostic
6. Queue bounded: configurable max size; documented exhaustion policy
7. No silent event drops â€” expose `QUEUE_FULL` status
8. Recover from connectivity changes
9. WorkManager for deferred batch sync; foreground service for active capture

### 3.4 Exit Gate

- [ ] SDK initializes and starts tracking with balanced profile
- [ ] Events persisted to Room before upload
- [ ] Online: events arrive at server and are acknowledged
- [ ] Offline: queue grows, reconnect triggers replay
- [ ] Duplicate sync: replayed batch â†’ server returns duplicates, no double-insert
- [ ] Permission denial: graceful status callback, no crash
- [ ] Queue diagnostics: depth, oldest age, upload stats exposed
- [ ] Sample app demonstrates full lifecycle

---

## Phase 4 â€” Realtime & Operations

> **Goal:** Authorized WebSocket realtime updates, reconnect behavior, observability metrics, health probes, and reproducible load tests.

### 4.1 WebSocket Gateway

```
WebSocket /ws/v1/locations
  â”œâ”€â”€ Connection: authenticate via token
  â”œâ”€â”€ Subscribe: { deviceId } â†’ authorized check
  â”œâ”€â”€ Receive: location updates after ingest commit
  â”œâ”€â”€ Heartbeat: configurable interval
  â”œâ”€â”€ Reconnect: client fetches latest state, then subscribes
  â””â”€â”€ Backpressure: slow client does NOT block ingestion pipeline
```

- Realtime fan-out is **separate** from persistence path (PRD Â§6.6)
- Each subscription authorized against device/integration ownership
- Document reconnect behavior: client should `GET /locations/latest` then subscribe

### 4.2 Observability (PRD Â§6.7)

| Metric | Type | Source |
|---|---|---|
| `ule_events_accepted_total` | Counter | Ingestion |
| `ule_events_rejected_total` | Counter | Ingestion |
| `ule_events_duplicate_total` | Counter | Ingestion |
| `ule_ingestion_latency_ms` | Histogram | API |
| `ule_persistence_latency_ms` | Histogram | DB write |
| `ule_fanout_latency_ms` | Histogram | Realtime publish |
| `ule_device_freshness_seconds` | Gauge | Per-device |
| `ule_queue_depth` | Gauge | SDK diagnostic |
| `ule_db_pool_active` | Gauge | DB connection pool |

### 4.3 Load Testing

- Tool: k6 or Artillery
- Simulate: 1,000 devices Ã— 1 event/5s = 200 events/sec sustained
- Duration: 30â€“60 minutes minimum
- Measure: ingestion p50/p95/p99, fan-out latency, DB load, error rate
- Document: exact hardware, software versions, test configuration, results

### 4.4 Exit Gate

- [ ] WebSocket: authenticated subscription works
- [ ] WebSocket: unauthorized subscribe â†’ rejected
- [ ] WebSocket: reconnect â†’ fetch latest then resume
- [ ] WebSocket: slow client does not block ingestion
- [ ] Metrics: all PRD Â§6.7 metrics exposed
- [ ] Health: `/health/live` and `/health/ready` accurate
- [ ] Load test: results documented with exact conditions
- [ ] Performance targets validated or gaps documented

---

## Phase 5 â€” Packaging & Adoption

> **Goal:** Self-hosted setup, documentation, integration guides, `backend/.env.example`, migration/backup docs.

### 5.1 Deliverables

| Deliverable | Purpose |
|---|---|
| `backend/docker-compose.yml` | Local self-hosted PostGIS + API |
| `backend/Dockerfile` | Production-ready container |
| `backend/.env.example` | All env vars documented with safe defaults |
| `docs/api-guide.md` | API integration guide with examples |
| `docs/sdk-guide.md` | Android SDK integration guide |
| `docs/self-hosting.md` | Deployment, backup, restore, migration |
| `docs/configuration.md` | All configurable thresholds and profiles |
| `docs/architecture.md` | Architecture overview with diagrams |
| OpenAPI spec | Auto-generated, checked in CI |

### 5.2 Exit Gate

- [ ] `docker compose -f backend/docker-compose.yml up` â†’ working local instance
- [ ] `backend/.env.example` contains all required vars with documentation
- [ ] API guide has working curl examples
- [ ] SDK guide has working Kotlin integration example
- [ ] Backup/restore procedure tested
- [ ] Migration up/down tested

---

## Phase 6 â€” Optional Modules

> **Goal:** Geofencing, retention/cleanup, analytics extensions, admin/demo UI â€” each independently enableable.

### 6.1 Modules (implement only when explicitly prioritized)

| Module | Description | Enablement |
|---|---|---|
| Geofencing | Circular geofence CRUD + enter/exit/dwell detection | Feature flag |
| Retention | Configurable cleanup cron job | Config-driven |
| Analytics | Extended diagnostics dashboards | Optional module |
| Admin UI | Minimal operational console | Optional module |
| Multi-tenant adapter | Namespace/project context isolation | Adapter plugin |
| iOS SDK | Future native Swift client | Separate project |

### 6.2 Exit Gate

- [ ] Each module can be enabled/disabled independently
- [ ] Core engine works without any optional module
- [ ] Feature flags documented in configuration guide

---

## Dependency Changes

### Add

| Package | Purpose | Phase |
|---|---|---|
| `@nestjs/swagger` | OpenAPI generation | 2 |
| `@nestjs/websockets` + `socket.io` | WebSocket gateway | 4 |
| `@nestjs/throttler` | Rate limiting | 2 |
| `@nestjs/terminus` | Health checks | 2 |
| `@nestjs/schedule` | Cron jobs (retention) | 6 |
| `helmet` | Security headers | 2 |

### Already removed

| Package | Reason |
|---|---|
| `nodemailer` | Mail module removed â€” out of scope |

---

## Architecture Diagram

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    backend/src/core/ (Framework-independent)         â”‚
â”‚                                                             â”‚
â”‚  domain/          ports/              errors/               â”‚
â”‚  â”œâ”€â”€ LocationEvent  â”œâ”€â”€ EventStore      â”œâ”€â”€ ValidationError  â”‚
â”‚  â”œâ”€â”€ Freshness      â”œâ”€â”€ LatestLocation  â”œâ”€â”€ DuplicateError   â”‚
â”‚  â”œâ”€â”€ Accuracy       â”œâ”€â”€ AuthAdapter     â””â”€â”€ RateLimitError   â”‚
â”‚  â”œâ”€â”€ TrackingProfileâ”œâ”€â”€ DeviceIdentity                      â”‚
â”‚  â”œâ”€â”€ BatchResult    â”œâ”€â”€ RealtimePublisher                   â”‚
â”‚  â””â”€â”€ Idempotency    â””â”€â”€ Clock                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚ implements
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    backend/src/modules/ (NestJS adapters)            â”‚
â”‚                                                             â”‚
â”‚  locations/       devices/        auth/         health/     â”‚
â”‚  â”œâ”€â”€ Controller   â”œâ”€â”€ Controller  â”œâ”€â”€ Guard     â”œâ”€â”€ Controllerâ”‚
â”‚  â”œâ”€â”€ Service      â”œâ”€â”€ Service     â”œâ”€â”€ Adapter   â””â”€â”€ Service  â”‚
â”‚  â””â”€â”€ Repository   â””â”€â”€ Repository  â””â”€â”€ Strategy               â”‚
â”‚                                                             â”‚
â”‚  realtime/        (optional modules behind feature flags)   â”‚
â”‚  â””â”€â”€ Gateway      geofences/ retention/ admin-ui/           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚ uses
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              Infrastructure                                  â”‚
â”‚  PostgreSQL + PostGIS â”‚ WebSocket â”‚ Docker â”‚ Prisma          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```
