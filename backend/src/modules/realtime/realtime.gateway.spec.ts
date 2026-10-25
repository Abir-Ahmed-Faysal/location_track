import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtService } from '../auth/jwt.service';
import type { MetricsService } from '../metrics/metrics.service';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway subscription authorization', () => {
  const device = { id: 'device-1', ownerId: 'owner-1' };

  function createGateway(role: 'ADMIN' | 'USER', ownerId: string | null = device.ownerId) {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role }) },
      device: { findFirst: jest.fn().mockResolvedValue({ ...device, ownerId }) },
    };
    const metrics = { recordWebsocketSubscription: jest.fn() };
    const gateway = new RealtimeGateway(
      {} as JwtService,
      prisma as unknown as PrismaService,
      metrics as unknown as MetricsService,
    );
    const socket = { data: { userId: 'requester-1' }, join: jest.fn().mockResolvedValue(undefined) } as unknown as Socket;
    return { gateway, socket, prisma, metrics };
  }

  it('allows an admin to subscribe to an active fleet device owned by someone else', async () => {
    const { gateway, socket, prisma, metrics } = createGateway('ADMIN', 'different-owner');
    await expect(gateway.subscribe(socket, { deviceId: device.id })).resolves.toEqual({ type: 'subscribed', deviceId: device.id });
    expect(prisma.device.findFirst).toHaveBeenCalledWith({ where: { id: device.id, status: 'ACTIVE' }, select: { id: true, ownerId: true } });
    expect(socket.join).toHaveBeenCalledWith(`device:${device.id}`);
    expect(metrics.recordWebsocketSubscription).toHaveBeenCalledWith('subscribed');
  });

  it('allows an ordinary user to subscribe to their own device', async () => {
    const { gateway, socket } = createGateway('USER', 'requester-1');
    await expect(gateway.subscribe(socket, { deviceId: device.id })).resolves.toEqual({ type: 'subscribed', deviceId: device.id });
  });

  it('rejects an ordinary user attempting to subscribe across owners', async () => {
    const { gateway, socket, metrics } = createGateway('USER', 'different-owner');
    await expect(gateway.subscribe(socket, { deviceId: device.id })).rejects.toBeInstanceOf(WsException);
    expect(socket.join).not.toHaveBeenCalled();
    expect(metrics.recordWebsocketSubscription).toHaveBeenCalledWith('rejected');
  });
});
