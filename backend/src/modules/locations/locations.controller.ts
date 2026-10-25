import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { LocationsService } from './locations.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

/** Versioned location ingestion endpoints. */
@Controller('locations')
@UseGuards(AuthGuard, RateLimitGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /** Accepts an atomic batch after authentication and domain validation. */
  @Post('batch')
  ingestBatch(
    @Body() input: IngestBatchDto,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.locationsService.ingestBatch(input, request.user?.id as string);
  }

  /** Returns the materialized latest location for a device. */
  @Get('latest')
  latest(
    @Query('deviceId') deviceId: string,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.locationsService.getLatest(
      deviceId,
      request.user?.id as string,
    );
  }

  /** Returns cursor-paginated location history for a device. */
  @Get('history')
  history(
    @Query('deviceId') deviceId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Req() request?: Request & { user?: { id?: string } },
  ) {
    return this.locationsService.getHistory(
      deviceId,
      request?.user?.id as string,
      limit === undefined ? undefined : Number(limit),
      cursor,
    );
  }
}
