# Reliable delivery and recovery audit

## Current acknowledgement boundary

`POST /api/v1/locations/batch` acknowledges an event only after the Prisma
transaction commits. The transaction writes `LocationEvent`, the PostGIS point,
`LatestLocation`, and `Device.lastSeenAt` atomically. A response is not returned
until the committed event IDs are read back.

This means a lost HTTP response after commit is safe to retry: the event ID is
unique and the retry is classified as a duplicate. A database failure before commit
returns an error and does not acknowledge the event.

## Retry and duplicate behavior

- Event IDs are the idempotency key.
- `createMany(..., skipDuplicates: true)` prevents double insertion.
- Concurrent identical requests result in one accepted event and one duplicate.
- Older replays remain in history but cannot move `LatestLocation` backwards.
- Realtime publishing occurs after persistence; a fan-out failure can cause an HTTP
  retry, but the retry remains idempotent.

## Recovery behavior

| Failure | Current behavior | Risk |
|---|---|---|
| Network loss before response | Client must retry the same event IDs | Safe only if client retains payload |
| API restart | PostgreSQL data remains; retries classify as duplicates | In-memory metrics reset; live WebSocket events are missed |
| Database unavailable before commit | Readiness fails/HTTP error; no acknowledgement | Client retry required |
| Database unavailable after commit | Client may see an error despite durable data | Safe retry due to event ID uniqueness |
| WebSocket disconnect | Client must fetch latest, then resubscribe | Intermediate live events are not replayed |
| Android process/device restart | Current in-memory queue is lost | **Confirmed event-loss risk** |

## Confirmed limitations

1. `InMemoryEventQueue` is not durable. Room/SQLite is required before claiming
   reliable offline recovery.
2. `SyncCoordinator` has no persistent retry schedule or WorkManager integration.
3. Prometheus export is now available only when `PROMETHEUS_ENABLED=true`; metric
   counters reset on API restart unless Prometheus is scraping continuously.
4. Histograms now expose p95/p99 through Prometheus queries, but no production
   percentile result is claimed until a load run is completed.
5. No 1,000-device load test has been run, so event-loss rate, delivery latency,
   recovery time, and error rate at that load are **not measured**.
6. WebSocket reconnect intentionally requires a latest-location fetch; missed
   intermediate events are not durable realtime messages.

## Corrective plan before production claims

1. Room/SQLite queue and WorkManager source wiring are now present; Android
   verification remains blocked until JDK/Gradle/Android SDK are installed.
2. WorkManager uses network constraints and unique work, while `SyncCoordinator`
   removes rows only for accepted/duplicate acknowledgements.
3. Prometheus counters/histograms now cover accepted, duplicate, rejected, HTTP
   latency, WebSocket connections, subscriptions, and delivery outcomes.
4. A Socket.IO client test runner is present; run staged loads: 10, 100, then 1,000
   simulated devices.
5. Measure accepted/duplicate/rejected counts, event-loss count, p50/p95/p99
   delivery latency, reconnect recovery time, and backend error rate.
6. Only after those tests document the measured guarantees; never claim zero data
   loss without a completed durable-queue and failure-injection test.

Redis is not required by this audit. It should be reconsidered only if distributed
coordination, cross-instance fan-out, or a durable server-side queue becomes a
demonstrated requirement.
