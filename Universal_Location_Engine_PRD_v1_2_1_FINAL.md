
## Final Product Requirements Document (PRD)

**Document status:** Final baseline for implementation
**Version:** 1.0
**Product type:** Reusable, self-hostable location-tracking engine
**Initial platform:** Android
**Initial scale target:** Approximately 1,000 concurrent devices
**Primary goal:** Balance location quality, update freshness, battery usage, data integrity, and operational simplicity.

---

## 1. Executive summary

Universal Location Engine (ULE) is an application-neutral, reusable location-tracking engine that can be integrated into multiple unrelated products without copying its core source code. It provides a native Android SDK, a versioned backend API, reliable event ingestion, geospatial persistence, and optional realtime delivery.

ULE is **not** a sales-management product and is **not** required to be a SaaS application. It must be self-hostable first. Each adopting project may run its own instance and database, use the SDK/API in its existing application, and connect its own authentication through an adapter.

The engine will optimize for a practical balance of:

- Outdoor location quality.
- Useful near-live update frequency.
- Battery-aware tracking.
- Offline capture and eventual synchronization.
- Durable, idempotent event ingestion.
- Clear freshness and accuracy metadata.
- A maintainable architecture that can scale beyond the initial target.

**Important limitation:** no general-purpose phone GPS system can guarantee 100% location accuracy or a new fix at an exact interval in every environment. The product must expose quality, freshness, and limitations honestly rather than promise impossible guarantees.

## 2. Product vision and principles

### 2.1 Vision

Build one reliable location engine that can be plugged into many products using stable contracts, SDKs, APIs, and adapters.

### 2.2 Principles

1. **Reusable core:** domain logic must not depend on a particular host application's business model.
2. **Self-hostable first:** an adopter can control deployment and data.
3. **Android-first, platform-extensible:** deliver Android first while keeping contracts suitable for a future iOS SDK.
4. **Integrity before superficial speed:** never acknowledge an event before durable acceptance.
5. **Accuracy-aware:** preserve provider-reported measurements and their uncertainty.
6. **Freshness-aware:** old positions must never be presented as live.
7. **Offline-resilient:** network loss should delay delivery, not silently discard queued events.
8. **Idempotent:** retries must not create duplicate logical records.
9. **Modular:** geofencing, realtime, retention, analytics, tenant isolation, and UI are optional capabilities.
10. **Evidence-based performance:** performance claims require reproducible tests.
11. **Privacy and security by default:** authorize every read and subscription, minimize sensitive logging, and document retention.
12. **No hidden SaaS assumptions:** no mandatory billing, subscription, sales workflow, or hosted control plane.

## 3. Goals and non-goals

### 3.1 Goals

- Provide a canonical location event contract.
- Capture Android location updates with configurable accuracy/power profiles.
- Continue capturing and queueing events when connectivity is unavailable, within Android and device limitations.
- Reliably upload queued events and acknowledge them after durable server acceptance.
- Prevent duplicate logical events during retries.
- Store location history and support efficient latest-location and spatial queries.
- Deliver authorized realtime updates to connected clients.
- Expose diagnostics for quality, freshness, queue health, latency, and errors.
- Support self-hosted deployment and straightforward integration into other projects.
- Support approximately 1,000 concurrently active devices as the initial capacity target, subject to load testing.

### 3.2 Non-goals for v1

- Guaranteeing 100% GPS accuracy.
- Guaranteeing uninterrupted background tracking on every Android model.
- Guaranteeing delivery while a device is offline.
- Building a mandatory SaaS control plane, billing system, or subscription system.
- Building a sales CRM, workforce-management product, or business-specific workflows.
- Shipping an iOS SDK in v1.
- Requiring Kafka or microservices before measured load demonstrates a need.
- Treating mock-location detection as infallible fraud proof.
- Providing an admin UI as a prerequisite for the engine to work.

## 4. Users and integration model

### 4.1 Primary users

- Developers integrating location tracking into existing mobile applications.
- Backend developers deploying and operating a location service.
- Product teams that need current position, location history, or optional geofencing.
- Operators diagnosing stale data, delayed uploads, poor accuracy, or connectivity issues.

### 4.2 Integration options

**Option A — SDK + self-hosted API (primary v1 path):** install the Kotlin SDK in the Android app and send events to a self-hosted ULE API.

**Option B — API-only integration:** an existing client that already captures location can submit events using the documented API contract.

**Option C — reusable core/contracts package:** publish or package stable domain contracts and interfaces so another backend can integrate the engine without copying its implementation. Keep framework-specific adapters separate.

The first release should focus on Option A and a well-documented API. Do not claim that a standalone library package is production-ready unless it is actually packaged and tested.

## 5. Recommended architecture

```text
Android application
  └── Universal Location Engine Kotlin SDK
      ├── Android location provider adapter
      ├── Tracking profile / lifecycle manager
      ├── Persistent local event queue
      ├── Retry + acknowledgement manager
      └── HTTPS batch uploader
                 |
                 v
        Versioned NestJS API
          ├── Authentication adapter
          ├── Request validation
          ├── Idempotent ingestion
          ├── Durable persistence
          └── Authorized realtime publisher
                 |
                 v
       PostgreSQL + PostGIS
          ├── Location event history
          ├── Latest-location read model
          └── Spatial/time indexes
                 |
                 v
       Authorized WebSocket subscribers
```

### 5.1 Backend technology

- NestJS and TypeScript.
- PostgreSQL.
- PostGIS for spatial data and queries.
- Prisma for ordinary CRUD and migrations where appropriate.
- Parameterized, tested SQL for PostGIS-specific or performance-sensitive operations.
- WebSocket delivery behind an adapter.
- Docker Compose for local self-hosted development if compatible with the repository.

### 5.2 Architecture boundaries

The core domain must be independent of:

- NestJS controllers and transport details.
- A specific database vendor.
- A particular authentication vendor.
- Host application business logic.

Define clear interfaces/ports for storage, authentication/identity, transport, clock/time, and optional features. Avoid unnecessary abstractions that make the system harder to understand.

### 5.3 Multi-project and tenant isolation

Multi-tenancy is not a mandatory core product feature. However, data ownership boundaries must be explicit. The system must support an integration/project/namespace context when needed and prevent cross-project reads or subscriptions. Isolation can be implemented by a replaceable identity/context adapter; do not assume every adopter shares one central server.

## 6. Functional requirements

Priority labels:

- **P0:** required for a useful and safe v1.
- **P1:** important; implement after the P0 path is sound.
- **P2:** optional extension or later release.

### 6.1 Android location capture

- **P0:** Provide a native Kotlin SDK with documented setup, initialization, configuration, start, stop, and diagnostics APIs.
- **P0:** Use Android's fused location provider where appropriate.
- **P0:** Support explicit runtime permission and location-settings checks.
- **P0:** Support tracking while the app is visible and supported background tracking using the appropriate Android foreground-service and permission model.
- **P0:** Make tracking profile and desired update interval configurable.
- **P0:** Preserve the provider-reported accuracy and capture timestamp.
- **P0:** Expose permission denial, provider errors, and stale-fix diagnostics.
- **P1:** Adapt the tracking profile based on movement/stationary state where reliable.
- **P1:** Provide a manual refresh request that requests a fresh fix but does not falsely promise one will be immediately available.
- **P1:** Provide optional mock-location/risk indicators where the platform exposes them.

The SDK must respect user consent, Android permissions, foreground-service requirements, background restrictions, and distribution policies. It must not promise identical behavior on every device.

### 6.2 Location event contract

Every accepted event should use a consistent schema across SDK, API, storage, and realtime messages.

Required or conditionally available fields:

| Field                       | Requirement                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `event_id`                | Unique idempotency key generated for the event                    |
| `device_id`               | Stable device identity within the integration's ownership model   |
| `latitude`, `longitude` | Required, range-validated coordinates                             |
| `accuracy_m`              | Provider-reported horizontal accuracy in metres, if available     |
| `captured_at`             | Time the device captured the fix                                  |
| `received_at`             | Server-generated time of receipt                                  |
| `sequence`                | Monotonic sequence or equivalent ordering metadata where feasible |
| `provider`                | Location provider/source, when available                          |
| `altitude_m`              | Optional measurement                                              |
| `speed_mps`               | Optional measurement                                              |
| `bearing_deg`             | Optional measurement                                              |
| `platform_version`        | Optional diagnostics, subject to privacy minimization             |
| `mock_location_indicator` | Optional risk signal, never definitive proof                      |

Requirements:

- Validate coordinate ranges, timestamps, numeric ranges, payload size, and supported schema version.
- Keep device capture time separate from server receipt time.
- Do not silently fabricate missing measurements.
- Preserve raw measurements even when quality is poor, unless an explicitly documented privacy or data policy says otherwise.
- Define handling for clock skew, duplicate IDs, late events, and out-of-order events.
- A reported accuracy radius is an estimate, not a guaranteed error bound.

### 6.3 Offline queue and delivery

- **P0:** Persist captured events locally before attempting upload.
- **P0:** Keep unacknowledged events across normal process restarts using durable local storage, such as SQLite.
- **P0:** Retry failures with bounded exponential backoff and jitter.
- **P0:** Remove events from the local queue only after the server acknowledges durable acceptance.
- **P0:** Use stable event IDs and idempotent server processing.
- **P0:** Batch events to reduce network overhead without delaying the latest point unnecessarily.
- **P0:** Recover from network connectivity changes.
- **P0:** Expose queue depth, oldest queued event age, upload attempts, and failures.
- **P1:** Define a configurable maximum local queue size and a documented policy for storage exhaustion.
- **P1:** Add supported reboot recovery where Android permissions and platform behavior permit it.

The delivery model is **at-least-once delivery with idempotent effects**. Exactly-once network delivery must not be claimed.

### 6.4 Ingestion API

- **P0:** Provide versioned HTTPS endpoints for batch ingestion and reading the latest location.
- **P0:** Authenticate and authorize incoming requests through a replaceable adapter.
- **P0:** Validate every event before persistence.
- **P0:** Return a clear acknowledgement identifying accepted, duplicate, and rejected events.
- **P0:** Acknowledge success only after durable acceptance.
- **P0:** Make retries safe using idempotency keys and database constraints.
- **P0:** Apply payload limits, rate limits, and sensible timeouts.
- **P1:** Provide pagination and filtering for history queries.
- **P1:** Publish an OpenAPI specification if supported by the codebase.

Exact routes and response formats must be defined in the implementation and documented consistently. Do not invent API behavior in documentation that the code does not implement.

### 6.5 Persistence and geospatial queries

- **P0:** Use PostgreSQL for durable event storage.
- **P0:** Configure PostGIS and an explicit spatial reference system consistently.
- **P0:** Add indexes for event ID uniqueness, device/time queries, and spatial queries.
- **P0:** Maintain an efficient latest-location read path that does not scan full history.
- **P0:** Update the latest-location record only when the incoming event is newer according to the documented ordering policy.
- **P0:** Use transactions where needed to keep persistence and latest-location state consistent.
- **P1:** Support bounding-box/proximity queries and history pagination.
- **P1:** Define configurable retention and cleanup hooks; do not silently delete history.
- **P1:** Document backup, restore, migration, and recovery procedures.
- **P2:** Consider time-based partitioning after measured volume and maintenance needs justify it.

### 6.6 Realtime delivery

- **P0:** Publish authorized latest-location updates to connected clients.
- **P0:** Keep realtime fan-out separate from the critical persistence path so a slow client cannot block ingestion.
- **P0:** Authorize each subscription against the relevant device/project/namespace ownership.
- **P0:** Document reconnection behavior and whether clients should fetch the latest state after reconnecting.
- **P1:** Use a transactional outbox or another tested reliable publish strategy to avoid silently losing events between database commit and publication.
- **P1:** Support filtering subscriptions by authorized device/group/context.

### 6.7 Observability

Provide metrics and structured diagnostics for:

- Accepted, rejected, duplicate, retried, and failed events.
- API ingestion latency and persistence latency.
- Server-to-client fan-out latency.
- Queue depth and oldest queued event age.
- Location freshness/staleness.
- Device upload failures and permission/provider problems when reported by the SDK.
- Database connection pool saturation and query latency.
- Service health and readiness.

Do not log precise coordinates, access tokens, or personal data by default.

### 6.8 Optional modules

These must remain independently enableable and must not be prerequisites for core tracking:

- Geofencing.
- Retention/cleanup automation.
- Analytics and diagnostics extensions.
- Admin/demo UI.
- Multi-tenant context adapter.
- Hosted/managed deployment conveniences.
- Future iOS SDK.

## 7. Initial tracking configuration

The following are starting defaults for outdoor tracking. They are tunable engineering defaults, not guarantees about Android update cadence or location error.

| Profile                | Desired location interval | Distance filter | Intended use                           |
| ---------------------- | ------------------------: | --------------: | -------------------------------------- |
| Active / high accuracy |                 5 seconds |        5 metres | Active movement and near-live tracking |
| Balanced               |                10 seconds |       10 metres | Normal movement with battery awareness |
| Stationary / low power |            30–60 seconds |   15–25 metres | Low movement or stationary periods     |
| Custom                 |              Configurable |    Configurable | Integrator-specific requirements       |

Recommended default: **Balanced**, with an increase in sampling frequency during active movement if the product needs it.

Implementation notes:

- Use Android location priority appropriate to the selected profile.
- Treat requested intervals as best-effort hints.
- A distance filter is a request/filtering policy, not a guarantee that every reported position is that far from the previous one.
- Do not batch-delay the freshest location merely to fill a batch.
- Expose an explicit freshness status to consumers.
- Test battery usage on real devices; do not estimate it as a guaranteed percentage.

## 8. Initial upload configuration

| Setting                      | Initial default                                            |
| ---------------------------- | ---------------------------------------------------------- |
| Upload while actively moving | Flush approximately every 5 seconds                        |
| Batch limit                  | Up to 5 events, or flush after 5 seconds                   |
| Manual refresh               | Request/upload the freshest available fix promptly         |
| Retry policy                 | Exponential backoff with jitter and bounded maximum delay  |
| Local persistence            | SQLite-backed queue or equivalent durable storage          |
| Success acknowledgement      | Only after durable server acceptance                       |
| Duplicate handling           | Stable event ID + idempotent ingestion                     |
| Reconnect behavior           | Replay queued history and preserve correct latest position |

These values should be configurable. The engine must separate location acquisition, upload, durable persistence, and realtime fan-out so each can be measured independently.

## 9. Freshness and quality semantics

Initial UI/application conventions:

| Condition                            | Suggested classification |
| ------------------------------------ | ------------------------ |
| Reported accuracy ≤ 25 m            | Good estimated accuracy  |
| Reported accuracy > 25 m and ≤ 50 m | Reduced confidence       |
| Reported accuracy > 50 m             | Poor estimated accuracy  |
| Captured within 15 seconds           | Fresh                    |
| 15–60 seconds old                   | Delayed                  |
| More than 60 seconds old             | Stale                    |

These are configurable product-level thresholds, not universal GPS standards. Store the underlying values so each integrating product can set its own thresholds.

Freshness is based on capture time, not just server receipt time. If a location captured 90 seconds ago arrives now, it must not be represented as live. Where device/server clock skew makes age uncertain, expose that uncertainty rather than inventing precision.

## 10. Capacity and performance targets

### 10.1 Initial scale

Initial target: approximately **1,000 concurrently active devices**.

At one event every five seconds per device:

- 200 events per second.
- 720,000 events per hour.
- 17.28 million events per day if sustained for 24 hours.
- 5.76 million events over an eight-hour active day if all 1,000 devices track continuously during that period.

These are arithmetic estimates, not measured capacity results.

### 10.2 Initial infrastructure baseline

A starting self-hosted deployment may use:

- API: 2–4 vCPU and 4–8 GB RAM.
- PostgreSQL/PostGIS: 4 vCPU and 8–16 GB RAM, SSD-backed storage.
- Connection pooling, database backups, disk monitoring, and service health checks.

Actual requirements depend on history retention, indexes, query mix, batch size, realtime subscribers, event size, and host environment. Load test before promising capacity.

### 10.3 Performance targets

Targets to validate under a documented representative test load:

- Ingestion API p95 below 500 ms, excluding GPS acquisition and external device network latency.
- Server-to-connected-client fan-out p95 below 1 second after durable acceptance, under the same stated conditions.
- No loss of acknowledged events in application-level retry/duplicate test scenarios.
- Latest-location queries remain responsive under expected history growth.

These are acceptance targets, not claims that the current implementation already meets them. Record the hardware, software versions, event rate, subscriber count, test duration, p50/p95/p99 latency, and error rate for each benchmark.

## 11. Security and privacy requirements

- Use replaceable authentication and device identity adapters.
- Authorize reads and realtime subscriptions by ownership/context.
- Validate and limit all incoming requests.
- Store secrets in environment/configuration or a secret manager, never in source control.
- Use TLS in deployed environments.
- Configure CORS and WebSocket origins securely.
- Avoid precise coordinates and tokens in default logs.
- Make retention policy configurable and documented.
- Do not reset, drop, or truncate a production or unknown database.
- Treat mock-location indicators as signals, not conclusive fraud detection.
- Document permission and privacy expectations for integrating applications.
- Ensure one integration cannot access another integration's data accidentally.

## 12. Failure handling requirements

Document and test behavior for:

- Device has no network.
- Server accepts an event but the response is lost.
- Duplicate events are uploaded.
- Events arrive out of order.
- Device clock is wrong.
- App process is killed or restarted.
- Device reboots.
- Location permission is revoked.
- Location services are disabled.
- Local queue storage is exhausted.
- Server or database is unavailable.
- Realtime client disconnects.
- Migration or deployment fails.

The system should fail visibly and recover safely where possible. Do not silently discard events or report successful upload without durable acknowledgement.

## 13. Testing and acceptance criteria

### 13.1 Automated tests

- Coordinate and payload validation.
- Invalid timestamps and clock-skew policy.
- Duplicate event IDs and idempotent retries.
- Late/out-of-order event handling.
- Durable acknowledgement behavior.
- Latest-location ordering.
- Authorization and cross-context isolation.
- Local queue persistence and retry behavior.
- Realtime subscription authorization.
- Migration and spatial query correctness.
- API contract and error responses.

### 13.2 Load and field tests

Before declaring v1 production-ready:

- Simulate 1,000 devices at the target upload cadence for 30–60 minutes or longer as needed.
- Measure ingestion p50/p95/p99 latency, throughput, failures, database load, and realtime fan-out latency.
- Test duplicate and lost-response retries.
- Test 10–30 minutes offline followed by reconnect and replay.
- Verify historical replay does not overwrite a newer latest location.
- Test battery drain, location accuracy estimates, update gaps, and background behavior on several real Android models.
- Test stale/fresh status and manual refresh behavior.
- Verify backup and restore.

Do not claim a test passed unless it was run and its result recorded.

## 14. Repository implementation plan

The implementation agent must inspect the actual repository and current Git changes before modifying files. Preserve user changes and do not assume previous plans were implemented.

### Phase 0 — Audit and safe baseline

- Inspect repository, manifests, modules, database schema/migrations, tests, docs, and Git status.
- Record baseline build/test outcomes.
- Identify starter or SaaS-specific modules and determine whether they should be removed, made optional, or retained.
- Verify the exact database environment before any destructive operation.
- Write a short architecture decision record.

### Phase 1 — Core contracts

- Implement canonical event types, validation, ports, idempotency, ordering, and quality/freshness semantics.
- Add unit tests.

### Phase 2 — Backend ingestion and persistence

- Implement versioned API, durable writes, PostGIS migrations/indexes, latest-location reads, authentication boundaries, and API documentation.
- Add integration tests.

### Phase 3 — Android SDK

- Implement location acquisition, profiles, lifecycle/permissions, persistent queue, retries, acknowledgements, and diagnostics.
- Test what can be tested locally and identify real-device-only verification.

### Phase 4 — Realtime and operations

- Implement authorized realtime updates, reconnect behavior, metrics, health/readiness, and reproducible load tests.

### Phase 5 — Packaging and adoption

- Provide local self-hosted setup, safe `.env.example`, API and SDK integration guides, configuration reference, migration/backup documentation, and a minimal example host integration.
- Document public contract versioning and compatibility.

### Phase 6 — Optional modules

- Add geofencing, analytics, UI, iOS, or hosted conveniences only when the core is reliable and the feature is explicitly prioritized.

## 15. Definition of done

Report each item as **Complete**, **Partial**, **Blocked**, or **Not started**:

- [ ] Core is application-neutral and documented.
- [ ] Versioned API and canonical event contract are documented.
- [ ] Validation, timestamps, quality, and freshness semantics are consistent end-to-end.
- [ ] Server acknowledges only after durable acceptance.
- [ ] Retries are idempotent and duplicates are tested.
- [ ] Offline queue/recovery is implemented and tested to the extent possible.
- [ ] Latest-location and history queries are indexed and tested.
- [ ] PostGIS migrations/setup are reproducible.
- [ ] Authorization prevents cross-project/device data leakage.
- [ ] Realtime delivery is authorized and does not block persistence.
- [ ] Metrics expose freshness, latency, failures, and queue health.
- [ ] Secrets and precise coordinates are not leaked in logs/examples.
- [ ] Build, lint, type checks, and relevant tests have actually run.
- [ ] Self-hosting and integration documentation matches the code.
- [ ] Performance and battery results are measured or explicitly marked not measured.
- [ ] Remaining limitations and untested platform behavior are explicit.

Unchecked or untested items must not be reported as complete.

## 16. Required final implementation report

At the end of implementation, provide:

1. What changed, with key files/modules and purpose.
2. Architecture overview.
3. Implemented vs. not implemented checklist.
4. Exact commands run and actual verification outcomes.
5. Database/migration safety notes and target environment.
6. Actual performance/accuracy measurements, test conditions, or “not measured.”
7. Security/privacy protections and remaining gaps.
8. Exact local run instructions and environment variables.
9. A concrete integration example based on implemented interfaces.
10. Prioritized blockers and next steps.

## 17. Final product statement

Universal Location Engine v1 should deliver the most reliable and accurate location tracking that real Android hardware, operating-system rules, network conditions, and the tested backend can support. Its engineering target is near-live outdoor tracking with battery-aware sampling, durable offline delivery, idempotent ingestion, clear freshness/quality metadata, and secure realtime updates for approximately 1,000 active devices.

It must never claim 100% location accuracy, guaranteed fixed-interval GPS updates, or universal uninterrupted background execution. It must demonstrate performance through real tests, remain application-neutral, and be reusable without copying its core source into every adopting project.
"""
