# Universal Location Engine — Consolidated Implementation PRD
Version 1.2.1 | Updated 2026-10-25

> This document is the single canonical implementation plan. It supersedes conflicting phase numbers, MVP scope, and Definition of Done in earlier drafts. Treat production policy choices as approval gates; do not invent them.

## 1. Product objective

Build a reusable, tenant-safe location tracking engine that can be integrated into different business applications. MVP is Android-first, with a platform-neutral backend/API so a native iOS client can be added later. The system supports visible user-initiated tracking, live location, history, offline buffering, device/session management, and basic geofences.

No system can guarantee 100% GPS accuracy or uninterrupted background tracking on every Android device. Respect OS permissions, foreground-service rules, user consent, and device restrictions. Never implement covert tracking.

## 2. Canonical stack and architecture

- Backend: NestJS + TypeScript, modular monolith (do not introduce microservices in MVP).
- Data: PostgreSQL + PostGIS.
- ORM: Prisma for ordinary relational CRUD and transactions. Use safe parameterized raw SQL only for documented PostGIS operations or measured performance needs.
- Android: native Kotlin reusable SDK/library plus a minimal sample/demo app.
- Web: minimal operational console is included in MVP, but SDK/API usage must not depend on it.
- API: versioned REST under `/api/v1`, OpenAPI contract checked in CI.
- Realtime: authenticated and authorized WebSocket live updates are required in MVP. REST history/latest remain usable when sockets disconnect.
- iOS: not in MVP; preserve API and data contracts for a future native Swift client.
- Local development: Docker Compose. Production hosting/provider is owner-approved before production release.
- Maps: provider-neutral adapter; select a production map provider only after licensing/cost review.

## 3. MVP scope

### Required
1. Tenant-scoped users/memberships, device enrollment and revocation.
2. Start/end tracking sessions with explicit state and audit events.
3. Location ingestion with validation, quality metadata, stable event IDs, idempotency, and batch sync.
4. Android durable offline queue, bounded retries, visible tracking status and permission UX.
5. Latest location, health/freshness and cursor-paginated history APIs.
6. Authorized WebSocket live stream with reconnect/backpressure handling.
7. Basic circular geofences with enter/exit/dwell event primitives behind a feature flag.
8. Minimal operational web console for authorized device/session health and live/history views.
9. Tenant isolation, audit logging, retention/deletion capability, health/metrics/logging.
10. CI, migrations, automated tests, local setup and operations documentation.

### Explicitly out of scope
Native iOS app, polygon geofences, route optimization, AI prediction, CRM/payments, Kafka/microservices, webhook delivery platform, custom geocoding, unlimited offline storage, and guaranteed tracking after force-stop, power-off, permission denial, or OS restriction.

## 4. Decisions and defaults

These are provisional development defaults. Do not represent them as owner-approved production policies.

| Setting | Development default | Production approval |
|---|---|---|
| Tenant model | Multi-tenant from day one; tenant ID derived from trusted auth context | Owner approves onboarding and support-access policy |
| Human identity | OIDC-compatible adapter; mock provider only in local/test | Owner selects issuer/provider and configures secrets |
| Device auth | Separate short-lived/revocable device credential; store only hashed secret where applicable | Owner approves enrollment and rotation policy |
| Raw location retention | 90 days in local/staging config | Owner/legal review retention, deletion, data residency |
| Aggregated metrics retention | 12 months, subject to privacy review | Owner approves |
| Freshness | FRESH <=2 min; STALE >2 and <=10 min; OLD >10 min; UNKNOWN without trustworthy sample | Tune from product needs |
| Sampling | 30 seconds while moving; 25 m minimum displacement; balanced priority | Validate battery/device behaviour |
| Ingest batch | Default 100; max 500 events; body <=1 MiB | Load-test and tune |
| Rate limits | Human 120 req/min; device ingest 60 req/min/device; 2x burst for 10 sec | Load-test; 429 includes Retry-After |
| Offline queue | 50 MiB or 7 days pending events, whichever first; never silently delete unacknowledged events | Owner approves queue-full UX/policy |
| Retry | Exponential backoff with jitter, 2 sec start, cap 15 min; honor Retry-After | Test |
| Session | One ACTIVE/PAUSED session per device/tenant; repeated start with same client session ID is idempotent | Owner approves force-close policy |
| Pagination | Cursor; default 50, max 200; stable order `(recorded_at,id)` | API contract |
| WebSocket | 30 sec heartbeat; unhealthy after 2 missed heartbeats | Tune in load tests |
| IDs/time | UUID IDs; `timestamptz` UTC; RFC3339 UTC in API | Mandatory |

Production release is blocked until owner approves identity provider, tenant onboarding/support access, retention/legal basis/consent, hosting/region/backup RPO-RTO, target scale/SLO, map provider/licensing, release-time Android SDK/Play policy, and admin force-close rules. Safe local implementation may continue with config-driven defaults.

## 5. One canonical phase plan

Only this plan defines phase numbering. Complete each phase's exit gate before starting the next.

### Phase 0 — Repository audit
Inspect repo, Git status, stack/tool versions, existing architecture, migrations, tests, CI, environment/config, secrets handling and deployment. Run baseline checks where possible. Write:
- `docs/implementation/REPO_AUDIT.md`
- `docs/implementation/PLAN.md`
- `docs/implementation/OPEN_DECISIONS.md`
- risk register and ADRs for material deviations

Exit gate: requirements mapped to modules/files/tests; existing failures distinguished; no unresolved critical ambiguity for Phase 1. Do not make destructive changes.

### Phase 1 — Contracts and foundation
Create/adapt monorepo modules, OpenAPI, common errors, auth/tenant context, ERD, Prisma schema/migrations, PostGIS setup/indexes, session transition table, authorization matrix, event schema/versioning, CI and test harness.

Exit gate: clean DB migration works; OpenAPI validates; tenant-isolation tests exist; CI passes.

### Phase 2 — Backend core
Implement auth adapter, tenant/membership policies, device register/revoke, session lifecycle, location ingest/idempotency, latest/history/freshness/health APIs, validation/rate limits, audit/logging and health/readiness.

Exit gate: integration tests for state transitions, duplicates/concurrency, invalid inputs, cross-tenant denial and failure/rollback.

### Phase 3 — Android SDK and sample
Implement Kotlin library and sample app; permission/onboarding UX; visible foreground service; Room durable queue; sampling; WorkManager sync/retry; status callbacks; queue limits and lifecycle handling.

Exit gate: device tests for online/offline, duplicate sync, process death where OS permits, permission denial/revocation, auth expiry and queue-full handling.

### Phase 4 — Realtime, geofences, console
Implement authorized WebSocket subscribe/unsubscribe, heartbeat/reconnect/backpressure; basic circular geofence CRUD and enter/exit/dwell behind feature flag; minimal operational console.

Exit gate: tenant/auth tests, reconnect behavior, geofence boundary/repeat tests, console authorization tests.

### Phase 5 — Reliability/security/performance
Threat model, dependency/container scans, data retention/deletion/export, backup/restore and migration rollback plan, load/soak tests, battery/storage observations, alerts and dashboards.

Exit gate: no unresolved critical/high security finding; load report and limitations documented; staging restore drill completed.

### Phase 6 — Staging acceptance
E2E test report, Android device matrix, API compatibility, runbooks, production decision approvals, staging deployment/smoke test and rollback plan.

Exit gate: blockers resolved or owner explicitly accepts in writing; production secrets/policies configured.

### Phase 7 — Controlled production rollout
Roll out with monitoring, rollback triggers and incident contacts. Verify ingest, sync lag, errors, tenant isolation, retention jobs, backups and device health.

Exit gate: agreed SLOs stay within thresholds for the observation period; incidents have owners/mitigations.

## 6. API contract

All endpoints are under `/api/v1`; JSON UTF-8; UUID IDs; UTC RFC3339. OpenAPI is the executable source of truth.

### Endpoint inventory
- `POST /tenants` — controlled tenant bootstrap/platform operator
- `GET /tenants/current` — current authenticated tenant context
- `POST /tenants/{tenantId}/members` — tenant admin adds/invites member
- `POST /devices/register` — register device using authenticated user/enrollment token
- `POST /devices/{deviceId}/revoke` — tenant admin revoke
- `GET /devices` — list authorized tenant devices
- `POST /sessions` — device starts session (idempotency key/clientSessionId)
- `GET /sessions/{sessionId}` — authorized session state
- `POST /sessions/{sessionId}/end` — end session, idempotent
- `POST /locations:batch` — device batch ingestion
- `GET /locations/latest` — latest permitted location
- `GET /locations/history` — cursor history
- `GET /devices/{deviceId}/health` — freshness/sync health
- `POST /geofences`, `PATCH /geofences/{id}`, `GET /geofences`
- `GET /audit-events` — authorized audit query
- `GET /health/live`, `GET /health/ready`

Use standard statuses 200/201/204/400/401/403/404/409/413/422/429/5xx. Avoid leaking whether another tenant owns a resource; use 404 for inaccessible tenant resources where appropriate.

### Common error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "requestId": "uuid",
    "details": [{"field": "recordedAt", "reason": "must be RFC3339"}]
  }
}
```
Never return stack traces or secrets.

### Batch ingest request
```json
{
  "schemaVersion": 1,
  "deviceId": "uuid",
  "sessionId": "uuid",
  "events": [{
    "eventId": "uuid",
    "recordedAt": "2026-10-25T00:00:00Z",
    "latitude": 23.8103,
    "longitude": 90.4125,
    "horizontalAccuracyM": 12.5,
    "altitudeM": null,
    "speedMps": null,
    "bearingDeg": null,
    "provider": "FUSED",
    "isMock": false,
    "metadata": {}
  }]
}
```
Validate latitude [-90,90], longitude [-180,180], finite/nonnegative accuracy and speed, bearing [0,360), timestamp clock-skew policy, schema and metadata size. Max 500 events and 1 MiB. Default batch is atomic: validate all first; malformed event rejects the whole batch with structured details. Unique `(tenant_id,event_id)`; committed retry returns duplicate outcome, never a second row/side effect. Do not acknowledge durable acceptance before DB commit.

### Batch response
```json
{
  "accepted": ["event-uuid"],
  "duplicates": [],
  "rejected": [],
  "serverTime": "2026-10-25T00:00:02Z"
}
```

### Session start
```json
{
  "deviceId": "uuid",
  "clientSessionId": "uuid",
  "startedAt": "2026-10-25T00:00:00Z",
  "policy": {"intervalSeconds": 30, "minDisplacementM": 25, "priority": "BALANCED"}
}
```
Response includes `sessionId`, `state: ACTIVE`, `serverTime`, and `effectivePolicy`. Same `(tenant,device,clientSessionId)` returns same session. Different ID while a session is active returns `409 ACTIVE_SESSION_EXISTS`, unless an approved/audited force-close flow is used.

### History
`GET /locations/history?deviceId=uuid&from=RFC3339&to=RFC3339&limit=50&cursor=opaque`
Response `{ "items": [...], "nextCursor": null }`. Validate `from<=to`, limit default 50/max 200, stable `(recorded_at,id)` order, tenant/role authorization before querying.

## 7. Database model

Use UUID primary keys; `created_at/updated_at timestamptz`; all tenant-owned rows include `tenant_id NOT NULL`; enforce invariants with DB constraints and indexes.

| Table | Key fields | Required constraints/indexes |
|---|---|---|
| `tenants` | id, name, status, created_at | status check/enum |
| `users` | id, identity_subject, email, created_at | identity subject maps issuer+subject; email is not identity |
| `tenant_memberships` | id, tenant_id, user_id, role, status | unique tenant/user |
| `devices` | id, tenant_id, user_id nullable, external_device_key, platform, status, last_seen_at | unique tenant/external key; no raw secret |
| `tracking_sessions` | id, tenant_id, device_id, client_session_id, state, started_at, ended_at, end_reason, policy | unique tenant/device/client session; partial unique active/paused per tenant/device |
| `location_events` | id, tenant_id, event_id, device_id, session_id, recorded_at, received_at, position geography(Point,4326), latitude, longitude, accuracy, altitude/speed/bearing, provider, is_mock, metadata | unique tenant/event; indexes tenant/device/time, tenant/session/time; GiST position |
| `device_health_snapshots` | id, tenant_id, device_id, state, last_recorded/received, pending_count, reason_code, observed_at | tenant/device/observed index |
| `geofences` | id, tenant_id, name, center geography(Point,4326), radius_m, enabled | radius>0; spatial index as needed |
| `geofence_transitions` | id, tenant_id, geofence_id, device_id, session_id, transition, event_time, source_event_id | dedupe source transition |
| `audit_events` | id, tenant_id nullable, actor ids, action, resource, request_id, occurred_at, metadata | tenant/time and actor/time indexes; redact coordinates/secrets |
| `idempotency_records` | id, tenant_id, scope, key, response status/body, expires_at | unique tenant/scope/key; bounded TTL |

ER relationships: tenant has memberships/devices/sessions/events/geofences/audit; users join tenants through memberships; device has sessions/events/health; session contains events; geofence emits transitions.

PostGIS `geography(Point,4326)` is default for metre-based distance. Raw SQL must be parameterized and tenant-filtered. Tenant ID comes from verified auth context, not client body. Test Prisma and raw SQL tenant isolation. RLS may be defence-in-depth only if session tenant context is safe and tested.

## 8. Session state machine

States: `CREATED`, `ACTIVE`, `PAUSED`, `ENDED`, `FORCE_CLOSED`, `EXPIRED`.

- start -> ACTIVE by bound device; idempotent client session ID
- ACTIVE -> PAUSED by bound device if pause enabled
- PAUSED -> ACTIVE by bound device
- ACTIVE/PAUSED -> ENDED by bound device or authorized admin; idempotent
- ACTIVE/PAUSED -> FORCE_CLOSED by tenant admin with special permission, audit reason/actor/time; disabled until owner approval
- ACTIVE/PAUSED -> EXPIRED by system expiry job; record reason
- terminal state repeat returns same state; resume/new points rejected with 409 SESSION_NOT_ACTIVE
- DB constraint allows at most one ACTIVE/PAUSED session per tenant/device

## 9. Authorization matrix

Tenant roles: `TRACKED_USER/DEVICE`, `VIEWER`, `DISPATCHER`, `TENANT_ADMIN`, `AUDITOR`, `PLATFORM_OPERATOR`.

| Action | Tracked user/device | Viewer | Dispatcher | Tenant admin | Auditor | Platform operator |
|---|---|---|---|---|---|---|
| Start/end own session | bound device | no | no | policy | no | audited support only |
| Upload locations | bound device credential | no | no | no | no | no |
| View latest/history | own data if enabled | permitted | permitted | permitted | limited/audited | support-only audited |
| Device health | own device | permitted | permitted | permitted | limited | support-only |
| Register/revoke device | no | no | no | yes | no | bootstrap/support audited |
| Manage geofences | no | no | delegated | yes | no | audited |
| Manage memberships | no | no | no | yes | no | platform-only |
| Read audit | no | no | limited | yes | yes | audited |
| Change retention/security | no | no | no | request only | no | owner-approved config |
| Force-close session | no | no | no | disabled until approved | no | break-glass audited |

Every REST, WebSocket, job, export and console path enforces equivalent permission. Platform operator is not a universal bypass.

## 10. Android requirements

- Layout: `sdk/android-location` reusable library; `apps/android-sample` demo; adapt to repo's existing conventions.
- Kotlin, Gradle Kotlin DSL, AndroidX, Room, WorkManager, Coroutines.
- Proposed minSdk 26, subject to Phase 0 compatibility review. Select compile/target SDK against current Android/Play requirements at release; document chosen versions.
- Correct location foreground service type and runtime permission flow for chosen target. User disclosure and permissions before tracking.
- Visible persistent notification while active; explicit start/stop/status.
- No tracking on install, boot, login or remote command without explicit user action.
- Test force-stop, reboot, battery restrictions, permission changes, approximate-only, no GPS/network, app update; document OS/vendor limitations.
- Play release blocked pending owner-reviewed background-location declaration, prominent disclosure, privacy policy and Data Safety responses.

### Offline sync invariants
1. Persist to Room before network upload.
2. Generate UUID once; retries reuse ID/payload.
3. Mark/delete only after server accepted/duplicate acknowledgement.
4. Retry transient network/5xx/429 with jitter/backoff; honor Retry-After.
5. Permanent validation/auth errors do not loop; revoked credential pauses sync/re-enrollment.
6. Queue bounded; never silently drop unacknowledged events. On full queue show `QUEUE_FULL` and apply approved policy.
7. Protect credentials with Android Keystore; never log tokens/precise locations.
8. WorkManager is deferred/retry sync, not exact periodic tracking; foreground service handles active visible tracking.

## 11. Security, privacy and operations

- TLS in production; secrets from secret manager/env, never source control.
- Separate human/device credentials; least privilege, revocation and rotation.
- Tenant isolation tests across REST, WebSocket, raw SQL, jobs and exports.
- Audit enrollment/revocation, force-close, membership/role changes, retention changes, exports and support access.
- Redact tokens, secrets, full request bodies and precise coordinates from routine logs.
- Retention/delete/export idempotent, observable and tenant-scoped; document backup implications.
- Backup encryption, owner-approved RPO/RTO, staging restore drill and rollback strategy.
- Rate limits, request timeouts, body limits, DB pool limits and graceful shutdown.
- No unresolved critical/high security issue at release; exceptions require written owner risk acceptance.

## 12. Canonical Definition of Done

MVP accepted only with evidence:
- Phase 0 audit/plan reviewed; API OpenAPI, ERD, migration plan, state machine, authorization matrix and ADRs committed.
- Clean setup documented; migrations work on clean and upgrade DB.
- Ingest validation/idempotency/concurrency tests pass.
- Tenant-isolation tests pass for every query path, raw SQL and socket.
- Session transition constraints and cursor pagination are tested; geospatial indexes verified.
- Retention/delete/export behaviour tested.
- Android SDK usable from sample; permission/foreground UX tested; offline persistence/retry/duplicates/queue-full/auth expiry/permission changes tested on documented devices.
- WebSocket auth/tenant/reconnect/heartbeat tests pass; geofence boundary/repeat tests pass.
- CI lint/type/unit/integration/e2e/security checks pass; report includes exact commands.
- Load/soak report includes environment, dataset, concurrency, throughput, p95/p99, errors and limitations.
- Backup restore and rollback drills documented; owner production decisions approved; staging smoke test and rollback thresholds configured.
- Agent reports `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED` honestly. Never claim unrun tests passed.

## 13. Agent kickoff prompt

> Treat this PRD as the canonical source. Begin with Phase 0 only. Inspect the repository read-only; report stack, existing code, gaps, proposed file/module mapping, risks and owner decisions. Write `docs/implementation/REPO_AUDIT.md`, `PLAN.md`, `OPEN_DECISIONS.md`, and relevant ADRs. Do not implement Phase 1 or later in the same response. Preserve existing working code; no destructive reset without approval. Use Prisma by default and parameterized raw SQL only when justified. Never allow tenant-unscoped queries, covert tracking, secrets in source, weakened tests or fabricated results. Implement one phase at a time, run checks, report exact commands and truthful outcomes, and do not proceed until its exit gate is reviewed. Production-only decisions remain configurable and block production release, not safe local development.

## 14. Final note

This PRD is an implementation guide, not proof of implementation or production readiness. GPS accuracy, background continuity, battery impact and OS behaviour must be measured on real devices. Keep planned features labelled planned until implemented and tested.
