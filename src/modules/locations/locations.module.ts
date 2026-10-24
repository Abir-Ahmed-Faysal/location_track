import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

/** Location ingestion module. */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LocationsController],
  providers: [LocationsService, RateLimitGuard],
})
export class LocationsModule {}
