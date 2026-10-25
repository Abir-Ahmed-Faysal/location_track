# Reliability verification plan and evidence

The backend's durable acknowledgement boundary is covered by the existing
concurrent duplicate e2e test and the realtime restart test. A full failure
injection run is still pending because it requires a controlled test identity
with a set of registered devices and a repeatable load environment.

## Required measurements

For each staged run (10, 100, 1,000 clients), record:

- sent event IDs, accepted IDs, duplicate IDs, rejected IDs, and delivered IDs;
- loss rate (`sent - accepted - duplicate` versus client-observed delivery);
- delivery p50/p95/p99, HTTP error rate, WebSocket error/reconnect rate;
- recovery time after API restart, network outage, and database outage;
- client and API RSS/heap/CPU and Prometheus scrape snapshots.

## Failure matrix

| Injection | Expected acknowledgement behavior | Evidence required |
|---|---|---|
| Network loss before response | Client retries same event ID | no extra history row; duplicate response |
| API restart after commit | Retry is duplicate; history remains | accepted/duplicate counts and recovery time |
| Database unavailable before commit | No durable acknowledgement | error response and zero new row |
| Database unavailable after commit | Client may see error; retry is duplicate | row count and duplicate classification |
| WebSocket disconnect | Reconnect, resubscribe, fetch latest | reconnect time and missed-event characterization |

No zero-loss or production-readiness claim is made until these measurements are
captured in a controlled run.
