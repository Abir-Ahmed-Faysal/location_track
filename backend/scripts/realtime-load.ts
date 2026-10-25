import { io, Socket } from 'socket.io-client';
import crypto from 'node:crypto';

const url = process.env.LOAD_TEST_URL ?? 'http://localhost:3000/ws/v1/locations';
const connections = Number(process.env.LOAD_TEST_CONNECTIONS ?? 1000);
const messageRate = Number(process.env.LOAD_TEST_MESSAGE_RATE ?? 1);
const durationSeconds = Number(process.env.LOAD_TEST_DURATION_SECONDS ?? 30);
const token = process.env.LOAD_TEST_TOKEN;
const deviceIds = (process.env.LOAD_TEST_DEVICE_IDS ?? '').split(',').filter(Boolean);
const ingestUrl = process.env.LOAD_TEST_INGEST_URL ?? 'http://localhost:3000/api/v1/locations/batch';

if (!token) {
  throw new Error('LOAD_TEST_TOKEN is required');
}

async function main(): Promise<void> {
const started = Date.now();
let connected = 0;
let errors = 0;
let delivered = 0;
const latencies: number[] = [];
const sentAt = new Map<string, number>();
const clients: Socket[] = [];

for (let index = 0; index < connections; index += 1) {
  const client = io(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 3,
  });
  clients.push(client);
  client.on('connect', () => {
    connected += 1;
    const deviceId = deviceIds[index % deviceIds.length];
    if (deviceId) client.emit('subscribe', { deviceId }, () => undefined);
  });
  client.on('connect_error', () => {
    errors += 1;
  });
  client.on('location.updated', (event: { eventId?: string }) => {
    delivered += 1;
    if (event.eventId && sentAt.has(event.eventId)) {
      latencies.push(Date.now() - (sentAt.get(event.eventId) as number));
      sentAt.delete(event.eventId);
    }
  });
}

const interval = setInterval(() => {
  if (deviceIds.length === 0) return;
  const now = Date.now();
  const events = deviceIds.map((deviceId) => {
    const eventId = crypto.randomUUID();
    sentAt.set(eventId, now);
    return {
      eventId, deviceId, capturedAt: new Date(now).toISOString(),
      latitude: 23.8103, longitude: 90.4125, accuracyM: 10,
    };
  });
  void fetch(ingestUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ schemaVersion: 1, events }),
  }).then((response) => { if (!response.ok) errors += 1; }).catch(() => { errors += 1; });
}, Math.max(10, Math.floor(1000 / Math.max(1, messageRate))));

await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
clearInterval(interval);
for (const client of clients) client.disconnect();
const sorted = [...latencies].sort((a, b) => a - b);
const percentile = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;
console.log(JSON.stringify({
  connections,
  messageRate,
  durationSeconds,
  connected,
  connectionErrors: errors,
  delivered,
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
  elapsedMs: Date.now() - started,
  memory: process.memoryUsage(),
  cpu: process.cpuUsage(),
}, null, 2));
}

void main();
