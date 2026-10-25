# Universal Location Engine API

The API is served under `/api/v1`. Local Docker starts it at `http://localhost:5000`.

## Authentication

Create an account and obtain an access token:

```bash
curl -X POST http://localhost:5000/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@example.com","password":"change-me-123456","name":"Operator"}'

curl -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@example.com","password":"change-me-123456"}'
```

Use the returned `accessToken` as `Authorization: Bearer <token>`.

## Register a device

```bash
curl -X POST http://localhost:5000/api/v1/devices/register \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"externalDeviceKey":"phone-001","platform":"ANDROID"}'
```

Save the returned device `id` for ingestion and reads.

## Ingest a location batch

```bash
curl -X POST http://localhost:5000/api/v1/locations/batch \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "schemaVersion": 1,
    "events": [{
      "eventId": "00000000-0000-4000-8000-000000000001",
      "deviceId": "<DEVICE_ID>",
      "capturedAt": "2026-01-01T00:00:00.000Z",
      "latitude": 23.8103,
      "longitude": 90.4125,
      "accuracyM": 12
    }]
  }'
```

Retries with the same `eventId` are classified as duplicates and are not inserted twice.

## Read latest and history

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  'http://localhost:5000/api/v1/locations/latest?deviceId=<DEVICE_ID>'

curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  'http://localhost:5000/api/v1/locations/history?deviceId=<DEVICE_ID>&limit=50'
```

History responses include a cursor when more pages are available. Send it back as `cursor` for the next page.

## Health checks

- `GET /api/v1/health/live` checks process liveness.
- `GET /api/v1/health/ready` checks database readiness.

Errors use the canonical `{ "error": { "code", "message", "requestId", "details" } }` envelope.

## Operational metrics

Authenticated operators can inspect in-memory ingestion counters and latency:

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:5000/api/v1/metrics
```

These metrics are instance-local; use a shared Prometheus/Redis adapter for a
multi-instance production deployment.
