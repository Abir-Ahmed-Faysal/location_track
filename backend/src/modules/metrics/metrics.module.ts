import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { PrometheusController } from './prometheus.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [AuthModule],
  controllers: [MetricsController, PrometheusController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
