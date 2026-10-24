# Universal Location Engine — Canonical Implementation Plan

> **This is the single source of truth for implementation.**
> The AI agent must read this file before starting any phase.
> Cross-reference with `STATUS.md` for current progress and `RULES.md` for constraints.

---

## 0. Repository Baseline (after Phase 0 audit)

### What exists and is preserved

| Component | Path | Status |
|---|---|---|
| NestJS 11 + TypeScript 5.7 | `package.json`, `tsconfig.json` | ✅ Keep |
| Prisma 7.8 + PrismaPg adapter | `prisma/`, `src/prisma/` | ✅ Keep — extend schema |
| ConfigModule + Zod validation | `src/config/` | ✅ Keep — extend env vars |
| Global PrismaModule | `src/prisma/prisma.module.ts` | ✅ Keep |
| ValidationPipe (global) | `src/main.ts` | ✅ Keep |
| ESLint + Prettier | `eslint.config.mjs`, `.prettierrc` | ✅ Keep |
| Auth module (email/password) | `src/modules/auth/` | ⚠️ Refactor into adapter pattern |
| Users module | `src/modules/users/` | ⚠️ Evaluate — may become part of identity adapter |
| AllExceptionsFilter | `src/common/filters/` | ⚠️ Rewrite to PRD error format |
| API prefix `api` | `src/common/constants/` | ⚠️ Change to `api/v1` |

### What was removed (Phase 0 cleanup)

| Component | Reason |
|---|---|
| `src/modules/subscription/` | Out of scope — ULE is not a SaaS/newsletter product |
| `src/modules/mail/` | Out of scope — no email sending needed |
| `Subscription` Prisma model | Out of scope |
| Mail env vars & config | No longer referenced |

---

## Phase 1 — Core Contracts

> **Goal:** Define the canonical event types, validation rules, domain interfaces/ports, idempotency contracts, ordering semantics, and quality/freshness types — all with unit tests. No HTTP, no database yet.

### 1.1 Deliverables

#### Domain types and contracts (`src/core/domain/`)

| File | Purpose |
|---|---|
| `location-event.ts` | Canonical `LocationEvent` type matching PRD §6.2 |
| `location-event.schema.ts` | Zod validation: lat `[-90,90]`, lon `[-180,180]`, accuracy ≥0, speed ≥0, bearing `[0,360)`, timestamps, payload size |
| `freshness.ts` | Freshness classification: Fresh ≤15s, Delayed 15–60s, Stale >60s (configurable thresholds) |
| `accuracy.ts` | Accuracy classification: Good ≤25m, Reduced 25–50m, Poor >50m (configurable thresholds) |
| `tracking-profile.ts` | Profile definitions: Active (5s/5m), Balanced (10s/10m), Stationary (30–60s/15–25m), Custom |
| `event-ordering.ts` | Ordering semantics: sequence/captured_at-based, late/out-of-order handling |
| `idempotency.ts` | Idempotency key contract: `(event_id)` uniqueness, duplicate detection |
| `batch-result.ts` | Batch response type: `{ accepted[], duplicates[], rejected[], serverTime }` |
| `device-identity.ts` | Device identity type (stable `device_id` within integration ownership) |
| `clock-skew.ts` | Clock-skew policy: configurable tolerance window, uncertainty exposure |

#### Port interfaces (`src/core/ports/`)

| File | Purpose |
|---|---|
| `event-store.port.ts` | Interface for persisting/querying location events |
| `latest-location.port.ts` | Interface for latest-location read model |
| `auth.port.ts` | Replaceable authentication adapter interface |
| `device-identity.port.ts` | Replaceable device identity adapter interface |
| `realtime-publisher.port.ts` | Interface for realtime event fan-out |
| `clock.port.ts` | Abstraction for current time (testable) |

#### Error types (`src/core/errors/`)

| File | Purpose |
|---|---|
| `validation-error.ts` | Structured validation error with field-level details |
| `duplicate-event-error.ts` | Duplicate event detected |
| `unauthorized-error.ts` | Auth/authorization failure |
| `rate-limit-error.ts` | Rate limit exceeded with Retry-After |

### 1.2 Validation Rules (from PRD §6.2)

```
latitude:       [-90, 90], required, finite number
longitude:      [-180, 180], required, finite number
accuracy_m:     ≥ 0, optional (provider-reported)
captured_at:    valid ISO8601/RFC3339, required, clock-skew check
event_id:       valid UUID, required, unique per integration context
speed_mps:      ≥ 0, optional
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

## Phase 2 — Backend Ingestion & Persistence

> **Goal:** Implement versioned API, durable writes, PostGIS migrations/indexes, latest-location reads, authentication boundaries, and API documentation.

### 2.1 Database Schema

#### New/modified Prisma models + raw SQL for PostGIS

| Table | Key Fields | Notes |
|---|---|---|
| `location_events` | id (UUID), event_id (UUID unique), device_id, captured_at, received_at, latitude, longitude, accuracy_m, altitude_m, speed_mps, bearing_deg, provider, is_mock, sequence, metadata | PostGIS `geography(Point,4326)` via raw SQL; composite indexes on `(device_id, captured_at)` |
| `latest_locations` | id, device_id (unique), event_id (FK), latitude, longitude, accuracy_m, captured_at, received_at, freshness_status | Materialized latest — updated atomically with ingest only when newer |
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
  │
  ├── 1. Authenticate request (auth adapter port)
  ├── 2. Validate batch: schema version, size limits, event count
  ├── 3. Validate each event: coordinates, timestamps, fields
  │      └── ANY invalid → reject entire batch with structured errors
  ├── 4. DB Transaction:
  │      ├── Check existing event_ids → classify as duplicates
  │      ├── INSERT new events (with PostGIS point)
  │      ├── UPDATE latest_locations WHERE captured_at > existing
  │      └── COMMIT
  ├── 5. Fan-out to realtime publisher (async, non-blocking)
  └── 6. Return { accepted[], duplicates[], rejected[], serverTime }
```

### 2.4 Authentication Adapter

- Define `AuthAdapter` interface matching `src/core/ports/auth.port.ts`
- Implement `LocalAuthAdapter` using existing JWT auth as a starting adapter
- Auth is injected via NestJS DI — swappable per deployment
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

- Batch ingest: valid batch → all accepted
- Batch ingest: duplicate event_ids → classified as duplicates, no double-insert
- Batch ingest: invalid event in batch → entire batch rejected
- Batch ingest: concurrent identical batches → idempotent
- Latest location: updated only when captured_at is newer
- Latest location: old replay does NOT overwrite newer position
- Auth: unauthenticated request → 401
- Auth: request for another integration's data → 404 (not 403, no leaking)
- Health: /live returns 200, /ready returns 200 when DB connected
- PostGIS: spatial queries return correct results
- Rate limit: exceeding limit → 429 with Retry-After

### 2.8 Exit Gate

- [ ] `prisma migrate dev` succeeds on fresh PostGIS database
- [ ] All P0 endpoints functional with integration tests passing
- [ ] Idempotent ingest proven under concurrent test
- [ ] Latest-location ordering proven (old event doesn't overwrite newer)
- [ ] Auth adapter swappable via configuration
- [ ] Error format matches PRD specification
- [ ] `pnpm test` and `pnpm test:e2e` pass

---

## Phase 3 — Android SDK

> **Goal:** Native Kotlin SDK with location capture, profiles, lifecycle/permissions, persistent queue, retries, acknowledgements, and diagnostics.

### 3.1 Project Structure

```
sdk/android-location/                    ← Reusable library module
├── src/main/kotlin/.../ule/
│   ├── UniversalLocationEngine.kt       ← Public API entry point
│   ├── config/
│   │   └── TrackingConfig.kt            ← Profile configuration
│   ├── capture/
│   │   ├── LocationCapturer.kt          ← Fused location provider adapter
│   │   └── TrackingProfileManager.kt    ← Profile switching logic
│   ├── queue/
│   │   ├── EventQueue.kt                ← Room-backed persistent queue
│   │   ├── QueueDiagnostics.kt          ← Depth, oldest age, failures
│   │   └── QueuePolicy.kt              ← Size limits, exhaustion policy
│   ├── sync/
│   │   ├── BatchUploader.kt             ← HTTPS batch upload
│   │   ├── RetryManager.kt              ← Exponential backoff + jitter
│   │   ├── AcknowledgementHandler.kt    ← Process server responses
│   │   └── ConnectivityMonitor.kt       ← Network state changes
│   ├── service/
│   │   └── TrackingForegroundService.kt ← Android foreground service
│   ├── permissions/
│   │   └── PermissionManager.kt         ← Runtime permission checks
│   └── diagnostics/
│       └── EngineDiagnostics.kt         ← Status callbacks, metrics
│
apps/android-sample/                     ← Minimal demo app
├── MainActivity.kt
└── TrackingDemoActivity.kt
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

### 3.3 Offline Queue Invariants (PRD §6.3)

1. Persist to SQLite/Room **before** network upload
2. UUID event_id generated once — retries reuse same ID/payload
3. Remove from queue **only** after server `accepted` or `duplicate` ACK
4. Retry transient failures (5xx, 429, network) with exponential backoff + jitter
5. Permanent errors (4xx validation/auth) → stop retrying that event, expose diagnostic
6. Queue bounded: configurable max size; documented exhaustion policy
7. No silent event drops — expose `QUEUE_FULL` status
8. Recover from connectivity changes
9. WorkManager for deferred batch sync; foreground service for active capture

### 3.4 Exit Gate

- [ ] SDK initializes and starts tracking with balanced profile
- [ ] Events persisted to Room before upload
- [ ] Online: events arrive at server and are acknowledged
- [ ] Offline: queue grows, reconnect triggers replay
- [ ] Duplicate sync: replayed batch → server returns duplicates, no double-insert
- [ ] Permission denial: graceful status callback, no crash
- [ ] Queue diagnostics: depth, oldest age, upload stats exposed
- [ ] Sample app demonstrates full lifecycle

---

## Phase 4 — Realtime & Operations

> **Goal:** Authorized WebSocket realtime updates, reconnect behavior, observability metrics, health probes, and reproducible load tests.

### 4.1 WebSocket Gateway

```
WebSocket /ws/v1/locations
  ├── Connection: authenticate via token
  ├── Subscribe: { deviceId } → authorized check
  ├── Receive: location updates after ingest commit
  ├── Heartbeat: configurable interval
  ├── Reconnect: client fetches latest state, then subscribes
  └── Backpressure: slow client does NOT block ingestion pipeline
```

- Realtime fan-out is **separate** from persistence path (PRD §6.6)
- Each subscription authorized against device/integration ownership
- Document reconnect behavior: client should `GET /locations/latest` then subscribe

### 4.2 Observability (PRD §6.7)

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
- Simulate: 1,000 devices × 1 event/5s = 200 events/sec sustained
- Duration: 30–60 minutes minimum
- Measure: ingestion p50/p95/p99, fan-out latency, DB load, error rate
- Document: exact hardware, software versions, test configuration, results

### 4.4 Exit Gate

- [ ] WebSocket: authenticated subscription works
- [ ] WebSocket: unauthorized subscribe → rejected
- [ ] WebSocket: reconnect → fetch latest then resume
- [ ] WebSocket: slow client does not block ingestion
- [ ] Metrics: all PRD §6.7 metrics exposed
- [ ] Health: `/health/live` and `/health/ready` accurate
- [ ] Load test: results documented with exact conditions
- [ ] Performance targets validated or gaps documented

---

## Phase 5 — Packaging & Adoption

> **Goal:** Self-hosted setup, documentation, integration guides, `.env.example`, migration/backup docs.

### 5.1 Deliverables

| Deliverable | Purpose |
|---|---|
| `docker-compose.yml` | Local self-hosted PostGIS + API |
| `Dockerfile` | Production-ready container |
| `.env.example` | All env vars documented with safe defaults |
| `docs/api-guide.md` | API integration guide with examples |
| `docs/sdk-guide.md` | Android SDK integration guide |
| `docs/self-hosting.md` | Deployment, backup, restore, migration |
| `docs/configuration.md` | All configurable thresholds and profiles |
| `docs/architecture.md` | Architecture overview with diagrams |
| OpenAPI spec | Auto-generated, checked in CI |

### 5.2 Exit Gate

- [ ] `docker compose up` → working local instance
- [ ] `.env.example` contains all required vars with documentation
- [ ] API guide has working curl examples
- [ ] SDK guide has working Kotlin integration example
- [ ] Backup/restore procedure tested
- [ ] Migration up/down tested

---

## Phase 6 — Optional Modules

> **Goal:** Geofencing, retention/cleanup, analytics extensions, admin/demo UI — each independently enableable.

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
| `nodemailer` | Mail module removed — out of scope |

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    src/core/ (Framework-independent)         │
│                                                             │
│  domain/          ports/              errors/               │
│  ├── LocationEvent  ├── EventStore      ├── ValidationError  │
│  ├── Freshness      ├── LatestLocation  ├── DuplicateError   │
│  ├── Accuracy       ├── AuthAdapter     └── RateLimitError   │
│  ├── TrackingProfile├── DeviceIdentity                      │
│  ├── BatchResult    ├── RealtimePublisher                   │
│  └── Idempotency    └── Clock                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ implements
┌──────────────────────────▼──────────────────────────────────┐
│                    src/modules/ (NestJS adapters)            │
│                                                             │
│  locations/       devices/        auth/         health/     │
│  ├── Controller   ├── Controller  ├── Guard     ├── Controller│
│  ├── Service      ├── Service     ├── Adapter   └── Service  │
│  └── Repository   └── Repository  └── Strategy               │
│                                                             │
│  realtime/        (optional modules behind feature flags)   │
│  └── Gateway      geofences/ retention/ admin-ui/           │
└─────────────────────────────────────────────────────────────┘
                           │ uses
┌──────────────────────────▼──────────────────────────────────┐
│              Infrastructure                                  │
│  PostgreSQL + PostGIS │ WebSocket │ Docker │ Prisma          │
└─────────────────────────────────────────────────────────────┘
```
