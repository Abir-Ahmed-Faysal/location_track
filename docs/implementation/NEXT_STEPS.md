# Next implementation steps

Phase 2 backend is complete and verified. The next work should proceed in this order.

## Phase 3 â€” Android production SDK

1. Install Android Studio, Android SDK 35, and Gradle wrapper.
2. Replace `InMemoryEventQueue` with Room/SQLite persistence.
3. Implement a Retrofit/Ktor `BatchUploader` for `/api/v1/locations/batch`.
4. Add permission and fused-location-provider adapters in the host app.
5. Verify offline queue, reconnect replay, duplicate acknowledgements, and queue-full behavior.

Acceptance command:

```bash
./gradlew :android-location:build
```

## Phase 4 â€” Realtime and shared operations

1. Add an authenticated WebSocket gateway with owner-scoped subscriptions.
2. Publish only after persistence commit; slow clients must not block ingestion.
3. Export counters and latency to Prometheus or another shared metrics backend.
4. Add queue-depth and freshness gauges.
5. Run a documented load test at the PRD target and record p95/p99 results.

## Current limitations

- Metrics are instance-local in memory.
- Android scaffold has no platform location or Room implementation yet.
- No WebSocket gateway or load-test results are committed.
- Optional geofencing and retention modules remain intentionally disabled.
