import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { classifyAccuracy } from '../../core/domain/accuracy';
import { classifyFreshness } from '../../core/domain/freshness';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminDevicesQueryDto, AdminHistoryQueryDto } from './dto/admin-devices-query.dto';

const ACTIVE_WINDOW_SECONDS = 5 * 60;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns only fleet totals backed by persisted database fields. */
  async overview() {
    const now = new Date();
    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_SECONDS * 1000);
    const [totalDevices, activeDevices, devicesWithLocation, totalEvents, lastLocationUpdate] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 'ACTIVE', lastSeenAt: { gte: activeSince } } }),
      this.prisma.latestLocation.count(),
      this.prisma.locationEvent.count(),
      this.prisma.latestLocation.aggregate({ _max: { receivedAt: true } }),
    ]);

    return {
      totalDevices,
      activeDevices,
      devicesWithLocation,
      totalEvents,
      activeWindowSeconds: ACTIVE_WINDOW_SECONDS,
      lastLocationUpdateAt: lastLocationUpdate._max.receivedAt?.toISOString() ?? null,
    };
  }

  /** Lists devices and their latest persisted fix with bounded offset pagination. */
  async listDevices(query: AdminDevicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.search?.trim();
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' as const } },
              { externalDeviceKey: { contains: search, mode: 'insensitive' as const } },
              { owner: { email: { contains: search, mode: 'insensitive' as const } } },
              { owner: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [total, devices] = await Promise.all([
      this.prisma.device.count({ where }),
      this.prisma.device.findMany({
        where,
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          platform: true,
          status: true,
          createdAt: true,
          lastSeenAt: true,
          owner: { select: { id: true, name: true, email: true } },
          latestLocation: {
            select: {
              eventId: true,
              latitude: true,
              longitude: true,
              accuracyM: true,
              capturedAt: true,
              receivedAt: true,
            },
          },
          events: {
            take: 1,
            orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
            select: { altitudeM: true, speedMps: true, bearingDeg: true },
          },
        },
      }),
    ]);

    return {
      items: devices.map((device) => this.toDeviceSummary(device)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Returns a device and the fields needed by the read-only detail panel. */
  async getDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        platform: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        owner: { select: { id: true, name: true, email: true } },
        latestLocation: {
          select: {
            eventId: true,
            latitude: true,
            longitude: true,
            accuracyM: true,
            capturedAt: true,
            receivedAt: true,
          },
        },
        events: {
          take: 1,
          orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
          select: { altitudeM: true, speedMps: true, bearingDeg: true },
        },
      },
    });
    if (!device) throw new NotFoundException('Device');
    return this.toDeviceSummary(device);
  }

  /** Reads one bounded page of persisted events with optional capture-time bounds. */
  async getDeviceHistory(deviceId: string, query: AdminHistoryQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && !Number.isFinite(from.getTime())) {
      throw new BadRequestException('Invalid history start time');
    }
    if (to && !Number.isFinite(to.getTime())) {
      throw new BadRequestException('Invalid history end time');
    }
    if (from && to && from > to) {
      throw new BadRequestException('History start time must not be after end time');
    }

    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!device) throw new NotFoundException('Device');

    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const items = await this.prisma.locationEvent.findMany({
      where: {
        deviceId,
        ...(from || to
          ? { capturedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(cursor
          ? {
              OR: [
                { capturedAt: { lt: cursor.capturedAt } },
                { capturedAt: cursor.capturedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      take: (query.limit ?? 50) + 1,
      select: {
        id: true,
        eventId: true,
        deviceId: true,
        latitude: true,
        longitude: true,
        accuracyM: true,
        altitudeM: true,
        speedMps: true,
        bearingDeg: true,
        provider: true,
        capturedAt: true,
        receivedAt: true,
      },
    });
    const limit = query.limit ?? 50;
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page.at(-1);
    return {
      items: page,
      nextCursor:
        hasMore && last
          ? Buffer.from(JSON.stringify({ capturedAt: last.capturedAt.toISOString(), id: last.id })).toString('base64url')
          : null,
    };
  }

  private decodeCursor(cursor: string): { capturedAt: Date; id: string } {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || !('capturedAt' in parsed) || !('id' in parsed)) {
        throw new Error('Invalid cursor');
      }
      const capturedAt = new Date(String(parsed.capturedAt));
      if (!Number.isFinite(capturedAt.getTime()) || typeof parsed.id !== 'string' || !parsed.id) {
        throw new Error('Invalid cursor');
      }
      return { capturedAt, id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid history cursor');
    }
  }

  private toDeviceSummary<T extends {
    id: string;
    platform: string;
    status: string;
    createdAt: Date;
    lastSeenAt: Date | null;
    owner: { id: string; name: string | null; email: string } | null;
    latestLocation: {
      eventId: string;
      latitude: number;
      longitude: number;
      accuracyM: number | null;
      capturedAt: Date;
      receivedAt: Date;
    } | null;
    events: { altitudeM: number | null; speedMps: number | null; bearingDeg: number | null }[];
  }>(device: T) {
    const latest = device.latestLocation;
    const recentEvent = device.events[0];
    return {
      id: device.id,
      platform: device.platform,
      status: device.status,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      owner: device.owner,
      latestLocation: latest
        ? {
            ...latest,
            altitudeM: recentEvent?.altitudeM ?? null,
            speedMps: recentEvent?.speedMps ?? null,
            bearingDeg: recentEvent?.bearingDeg ?? null,
            freshnessStatus: classifyFreshness(latest.capturedAt),
            accuracyClassification: classifyAccuracy(latest.accuracyM),
          }
        : null,
    };
  }
}
