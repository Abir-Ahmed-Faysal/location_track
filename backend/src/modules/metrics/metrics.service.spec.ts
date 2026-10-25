import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('aggregates ingestion counters and latency', () => {
    const service = new MetricsService();

    service.recordIngestion(2, 1);
    service.recordIngestion(1, 0);
    service.recordRejected();
    service.recordLatency(10);
    service.recordLatency(20);

    expect(service.snapshot()).toEqual({
      eventsAcceptedTotal: 3,
      eventsDuplicateTotal: 1,
      batchesRejectedTotal: 1,
      ingestionLatencyMsLast: 20,
      ingestionLatencyMsAverage: 15,
    });
  });

  it('exports a Prometheus-compatible registry', async () => {
    const service = new MetricsService();
    service.recordIngestion(1, 1);
    service.recordWebsocketConnection('connected');
    const output = await service.prometheus();
    expect(output).toContain('ule_ingestion_events_accepted_total');
    expect(output).toContain('ule_websocket_connections_total');
  });
});
