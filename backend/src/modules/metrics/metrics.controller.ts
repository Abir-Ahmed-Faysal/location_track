import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { MetricsService } from './metrics.service';

@Controller('metrics')
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  snapshot() {
    return this.metrics.snapshot();
  }
}
