import { Controller, Get, NotFoundException } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/** Optional scrape endpoint. It has no dependency on a running Prometheus server. */
@Controller()
export class PrometheusController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  async scrape(): Promise<string> {
    if (process.env.PROMETHEUS_ENABLED !== 'true') {
      throw new NotFoundException('Prometheus metrics are disabled');
    }
    return this.metrics.prometheus();
  }
}
