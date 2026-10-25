import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly acceptedCounter: Counter<string>;
  private readonly duplicateCounter: Counter<string>;
  private readonly rejectedCounter: Counter<string>;
  private readonly ingestionLatency: Histogram<string>;
  private readonly httpLatency: Histogram<string>;
  private readonly websocketConnections: Counter<string>;
  private readonly websocketSubscriptions: Counter<string>;
  private readonly websocketDeliveries: Counter<string>;
  private accepted = 0;
  private duplicates = 0;
  private rejected = 0;
  private latencyTotalMs = 0;
  private latencySamples = 0;
  private lastLatencyMs = 0;

  constructor() {
    collectDefaultMetrics({ register: this.registry });
    this.acceptedCounter = new Counter({
      name: 'ule_ingestion_events_accepted_total',
      help: 'Location events durably accepted by the backend.',
      registers: [this.registry],
    });
    this.duplicateCounter = new Counter({
      name: 'ule_ingestion_events_duplicate_total',
      help: 'Location events rejected as already accepted.',
      registers: [this.registry],
    });
    this.rejectedCounter = new Counter({
      name: 'ule_ingestion_batches_rejected_total',
      help: 'Location batches rejected before durable acceptance.',
      registers: [this.registry],
    });
    this.ingestionLatency = new Histogram({
      name: 'ule_ingestion_latency_ms',
      help: 'Location ingestion latency in milliseconds.',
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 5000],
      registers: [this.registry],
    });
    this.httpLatency = new Histogram({
      name: 'ule_http_request_latency_ms',
      help: 'HTTP request latency in milliseconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 5000],
      registers: [this.registry],
    });
    this.websocketConnections = new Counter({
      name: 'ule_websocket_connections_total',
      help: 'WebSocket connection lifecycle events.',
      labelNames: ['event'],
      registers: [this.registry],
    });
    this.websocketSubscriptions = new Counter({
      name: 'ule_websocket_subscriptions_total',
      help: 'WebSocket subscription attempts.',
      labelNames: ['event'],
      registers: [this.registry],
    });
    this.websocketDeliveries = new Counter({
      name: 'ule_websocket_deliveries_total',
      help: 'Realtime location delivery attempts.',
      labelNames: ['result'],
      registers: [this.registry],
    });
  }

  recordIngestion(accepted: number, duplicates: number): void {
    this.accepted += accepted;
    this.duplicates += duplicates;
    this.acceptedCounter.inc(accepted);
    this.duplicateCounter.inc(duplicates);
  }

  recordRejected(): void {
    this.rejected += 1;
    this.rejectedCounter.inc();
  }

  recordLatency(milliseconds: number): void {
    this.latencyTotalMs += milliseconds;
    this.latencySamples += 1;
    this.lastLatencyMs = milliseconds;
    this.ingestionLatency.observe(milliseconds);
  }

  recordHttpLatency(
    method: string,
    route: string,
    statusCode: number,
    milliseconds: number,
  ): void {
    this.httpLatency.observe(
      { method, route, status_code: String(statusCode) },
      milliseconds,
    );
  }

  recordWebsocketConnection(event: 'connected' | 'disconnected'): void {
    this.websocketConnections.inc({ event });
  }

  recordWebsocketSubscription(
    event: 'subscribed' | 'rejected' | 'unsubscribed',
  ): void {
    this.websocketSubscriptions.inc({ event });
  }

  recordWebsocketDelivery(result: 'delivered' | 'no_server'): void {
    this.websocketDeliveries.inc({ result });
  }

  async prometheus(): Promise<string> {
    return this.registry.metrics();
  }

  snapshot() {
    return {
      eventsAcceptedTotal: this.accepted,
      eventsDuplicateTotal: this.duplicates,
      batchesRejectedTotal: this.rejected,
      ingestionLatencyMsLast: this.lastLatencyMs,
      ingestionLatencyMsAverage:
        this.latencySamples === 0
          ? 0
          : Math.round(this.latencyTotalMs / this.latencySamples),
    };
  }
}
