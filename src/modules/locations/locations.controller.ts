import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { LocationsService } from './locations.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';

/** Versioned location ingestion endpoints. */
@Controller('locations')
@UseGuards(AuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /** Accepts an atomic batch after authentication and domain validation. */
  @Post('batch')
  ingestBatch(@Body() input: IngestBatchDto) {
    return this.locationsService.ingestBatch(input);
  }

  /** Returns the materialized latest location for a device. */
  @Get('latest')
  latest(@Query('deviceId') deviceId: string) {
    return this.locationsService.getLatest(deviceId);
  }

  /** Returns cursor-paginated location history for a device. */
  @Get('history')
  history(
    @Query('deviceId') deviceId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.locationsService.getHistory(
      deviceId,
      limit ? Number(limit) : undefined,
      cursor,
    );
  }
}
