import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { MetricsModule } from '../metrics/metrics.module';
import { RealtimeModule } from '../realtime/realtime.module';

/** Location ingestion module. */
@Module({
  imports: [PrismaModule, AuthModule, MetricsModule, RealtimeModule],
  controllers: [LocationsController],
  providers: [LocationsService, RateLimitGuard],
})
export class LocationsModule {}
