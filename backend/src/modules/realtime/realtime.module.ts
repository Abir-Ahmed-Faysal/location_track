import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeGateway } from './realtime.gateway';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [AuthModule, PrismaModule, MetricsModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
