import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { validateBatch } from '../../core/domain/location-event.schema';
import { classifyFreshness } from '../../core/domain/freshness';
import { classifyAccuracy } from '../../core/domain/accuracy';
import type { IngestBatchDto } from './dto/ingest-batch.dto';

/** Persists validated location batches and maintains the latest read model. */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Atomically classifies duplicates, stores new events, and updates latest state. */
  async ingestBatch(input: IngestBatchDto, ownerId: string) {
    const validation = validateBatch(input);
    if (!validation.valid) {
      throw new BadRequestException({
        message: validation.details.map(
          (item) => `${item.field}: ${item.reason}`,
        ),
      });
    }

    const eventIds = validation.events.map((event) => event.eventId);
    const deviceIds = [
      ...new Set(validation.events.map((event) => event.deviceId)),
    ];
    const ownedDevices = await this.prisma.device.findMany({
      where: { id: { in: deviceIds }, ownerId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (ownedDevices.length !== deviceIds.length) {
      throw new BadRequestException('One or more devices are not available');
    }
    const existing = await this.prisma.locationEvent.findMany({
      where: { eventId: { in: eventIds } },
      select: { eventId: true },
    });
    const existingIds = new Set(existing.map((event) => event.eventId));
    const newEvents = validation.events.filter(
      (event) => !existingIds.has(event.eventId),
    );
    const serverTime = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (newEvents.length > 0) {
        await tx.locationEvent.createMany({
          data: newEvents.map((event) => ({
            ...event,
            capturedAt: event.capturedAt,
            receivedAt: serverTime,
          })),
          skipDuplicates: true,
        });
        for (const event of newEvents) {
          // Prisma cannot write geography values directly, so use a parameterized PostGIS query.
          await tx.$executeRaw`
            UPDATE "LocationEvent"
            SET "position" = ST_SetSRID(ST_MakePoint(${event.longitude}, ${event.latitude}), 4326)::geography
            WHERE "eventId" = ${event.eventId}
          `;
        }
      }

      for (const event of newEvents) {
        const persisted = await tx.locationEvent.findUnique({
          where: { eventId: event.eventId },
        });
        if (!persisted) continue;
        const current = await tx.latestLocation.findUnique({
          where: { deviceId: event.deviceId },
        });
        if (current && current.capturedAt >= persisted.capturedAt) continue;
        await tx.latestLocation.upsert({
          where: { deviceId: event.deviceId },
          create: {
            deviceId: event.deviceId,
            eventId: persisted.eventId,
            latitude: persisted.latitude,
            longitude: persisted.longitude,
            accuracyM: persisted.accuracyM,
            capturedAt: persisted.capturedAt,
            receivedAt: persisted.receivedAt,
            freshnessStatus: classifyFreshness(
              persisted.capturedAt,
              serverTime,
            ),
          },
          update: {
            eventId: persisted.eventId,
            latitude: persisted.latitude,
            longitude: persisted.longitude,
            accuracyM: persisted.accuracyM,
            capturedAt: persisted.capturedAt,
            receivedAt: persisted.receivedAt,
            freshnessStatus: classifyFreshness(
              persisted.capturedAt,
              serverTime,
            ),
          },
        });
      }

      await tx.device.updateMany({
        where: { id: { in: deviceIds }, ownerId, status: 'ACTIVE' },
        data: { lastSeenAt: serverTime },
      });
    });

    const persistedFromThisBatch = await this.prisma.locationEvent.findMany({
      where: {
        eventId: { in: newEvents.map((event) => event.eventId) },
        receivedAt: serverTime,
      },
      select: { eventId: true },
    });
    const acceptedIds = persistedFromThisBatch.map((event) => event.eventId);
    const acceptedSet = new Set(acceptedIds);

    return {
      accepted: acceptedIds,
      duplicates: [
        ...existingIds,
        ...newEvents
          .map((event) => event.eventId)
          .filter((eventId) => !acceptedSet.has(eventId)),
      ],
      rejected: [],
      serverTime: serverTime.toISOString(),
    };
  }

  /** Returns the materialized latest location for one device. */
  async getLatest(deviceId: string, ownerId: string) {
    const latest = await this.prisma.latestLocation.findFirst({
      where: { deviceId, device: { ownerId, status: 'ACTIVE' } },
    });
    if (!latest) throw new NotFoundException('Device');
    return {
      ...latest,
      freshnessStatus: classifyFreshness(latest.capturedAt),
      accuracyClassification: classifyAccuracy(latest.accuracyM),
    };
  }

  /** Returns history ordered newest first using an opaque capturedAt/id cursor. */
  async getHistory(
    deviceId: string,
    ownerId: string,
    limit = 50,
    cursor?: string,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException(
        'History limit must be an integer between 1 and 200',
      );
    }
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    let decoded: { capturedAt: string; id: string } | null = null;
    if (cursor) {
      try {
        const value: unknown = JSON.parse(
          Buffer.from(cursor, 'base64url').toString('utf8'),
        );
        if (
          !value ||
          typeof value !== 'object' ||
          !('capturedAt' in value) ||
          !('id' in value) ||
          typeof value.capturedAt !== 'string' ||
          typeof value.id !== 'string'
        ) {
          throw new Error('invalid cursor');
        }
        if (!Number.isFinite(new Date(value.capturedAt).getTime())) {
          throw new Error('invalid cursor timestamp');
        }
        decoded = { capturedAt: value.capturedAt, id: value.id };
      } catch {
        throw new BadRequestException('Invalid history cursor');
      }
    }
    const items = await this.prisma.locationEvent.findMany({
      where: {
        deviceId,
        device: { ownerId, status: 'ACTIVE' },
        ...(decoded
          ? {
              OR: [
                { capturedAt: { lt: new Date(decoded.capturedAt) } },
                {
                  capturedAt: new Date(decoded.capturedAt),
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
    });
    if (items.length === 0 && !cursor) {
      const device = await this.prisma.device.findFirst({
        where: { id: deviceId, ownerId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!device) throw new NotFoundException('Device');
    }
    const hasMore = items.length > safeLimit;
    const page = hasMore ? items.slice(0, safeLimit) : items;
    const last = page.at(-1);
    return {
      items: page,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({
                capturedAt: last.capturedAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }
}
