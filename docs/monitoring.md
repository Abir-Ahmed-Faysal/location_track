# Monitoring and load testing

Monitoring is optional. The API does not require Prometheus or Grafana to run.
Set `PROMETHEUS_ENABLED=true` to expose the scrape endpoint at `GET /metrics`.
The optional Docker profile starts both tools:

```sh
docker compose -f backend/docker-compose.yml --profile monitoring up -d
```

The API exports ingestion counters, HTTP and ingestion latency histograms,
WebSocket connection/subscription/delivery counters, and default Node.js
process metrics. Prisma's current adapter does not expose a pool gauge, so no
fake database-pool metric is emitted.

The load runner is intentionally opt-in:

```sh
LOAD_TEST_TOKEN=... LOAD_TEST_CONNECTIONS=1000 \
LOAD_TEST_DEVICE_IDS=id1,id2 LOAD_TEST_DURATION_SECONDS=60 \
node --experimental-strip-types backend/scripts/realtime-load.ts
```

When device IDs are supplied, the runner also posts batches at
`LOAD_TEST_MESSAGE_RATE` (events/second) to `LOAD_TEST_INGEST_URL` and matches
event IDs to realtime deliveries. Use IDs owned by the token; otherwise the
backend will correctly reject the batch.

It reports connection errors, delivered events, p50/p95/p99 latency when the
event includes `sentAt`, RSS/heap usage, CPU usage, and elapsed time. A run is
not a proof of zero loss; compare sent, accepted, duplicate, rejected, and
delivered counts from the backend and client.
