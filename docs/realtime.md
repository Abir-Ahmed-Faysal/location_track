# Realtime protocol contract

Realtime delivery is intentionally separate from the durable ingestion transaction.
The planned endpoint is `WebSocket /ws/v1/locations`.

## Connection

- Authenticate during connection with the same access-token boundary as HTTP APIs.
- Reject invalid or expired credentials.
- Do not expose a device subscription until ownership is confirmed.

## Subscription messages

```json
{ "type": "subscribe", "deviceId": "<DEVICE_ID>" }
{ "type": "unsubscribe", "deviceId": "<DEVICE_ID>" }
```

Only devices owned by the authenticated context may be subscribed. Unauthorized
subscriptions must not reveal whether a device exists.

## Event delivery

```json
{
  "type": "location.updated",
  "deviceId": "<DEVICE_ID>",
  "eventId": "<EVENT_ID>",
  "capturedAt": "2026-01-01T00:00:00.000Z",
  "latitude": 23.8103,
  "longitude": 90.4125
}
```

Events are published only after persistence commits. Slow clients are isolated with
bounded buffers; they must never delay the ingestion response.

## Reconnect

After reconnect, a client must call `GET /api/v1/locations/latest` first, then send
`subscribe`. This closes the gap between the last durable state and the live stream.

The WebSocket gateway and load-test implementation remain Phase 4 work.
