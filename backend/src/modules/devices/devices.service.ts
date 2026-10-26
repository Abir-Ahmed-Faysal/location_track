import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterDeviceDto } from './dto/register-device.dto';

/** Manages device enrollment used by location ingestion. */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Enrolls a device once; an administrator must approve it before ingestion. */
  async register(input: RegisterDeviceDto, ownerId: string) {
    const existing = await this.prisma.device.findUnique({
      where: { externalDeviceKey: input.externalDeviceKey },
    });
    if (existing?.ownerId === ownerId) {
      return existing;
    }
    if (existing) {
      throw new ConflictException('Device is already registered');
    }

    try {
      return await this.prisma.device.create({
        data: {
          externalDeviceKey: input.externalDeviceKey,
          platform: input.platform,
          status: 'PENDING',
          ownerId,
        },
      });
    } catch (error) {
      const errorRecord =
        error && typeof error === 'object'
          ? (error as Record<string, unknown>)
          : null;
      if (errorRecord?.code === 'P2002') {
        throw new ConflictException('Device is already registered');
      }
      throw error;
    }
  }

  async setStatus(deviceId: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.prisma.device.update({ where: { id: deviceId }, data: { status } });
  }

  /** Returns an active device or hides inaccessible IDs as a 404. */
  async findById(id: string, ownerId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, ownerId, status: 'ACTIVE' },
    });
    if (!device) throw new NotFoundException('Device');
    return device;
  }
}
