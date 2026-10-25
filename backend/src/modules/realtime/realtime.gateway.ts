import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { Server } from 'socket.io';
import { WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '../auth/jwt.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

type SubscriptionMessage = { deviceId?: string };
type AuthSocket = Socket;

const trustedOrigins = (
  process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** Authenticated, owner-scoped realtime subscription gateway. */
@WebSocketGateway({
  namespace: '/ws/v1/locations',
  cors: { origin: trustedOrigins, credentials: true },
})
@Injectable()
export class RealtimeGateway {
  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  handleConnection(client: AuthSocket): void {
    const token = this.extractToken(
      client.handshake.auth?.token,
      client.handshake.headers.cookie,
    );
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verifyAccessToken(token);
      const data = client.data as unknown as { userId?: unknown };
      data.userId = typeof payload.sub === 'string' ? payload.sub : undefined;
      this.metrics.recordWebsocketConnection('connected');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    this.metrics.recordWebsocketConnection('disconnected');
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() message: SubscriptionMessage,
  ) {
    const deviceId = message.deviceId;
    const userId = this.getUserId(client);
    if (!deviceId || !userId) {
      this.metrics.recordWebsocketSubscription('rejected');
      throw new WsException('Subscription not authorized');
    }
    const [user, device] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      this.prisma.device.findFirst({
        where: { id: deviceId, status: 'ACTIVE' },
        select: { id: true, ownerId: true },
      }),
    ]);
    const authorized = Boolean(
      user && device && (user.role === 'ADMIN' || device.ownerId === userId),
    );
    if (!authorized) {
      this.metrics.recordWebsocketSubscription('rejected');
      throw new WsException('Subscription not authorized');
    }
    await client.join(`device:${deviceId}`);
    this.metrics.recordWebsocketSubscription('subscribed');
    return { type: 'subscribed', deviceId };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() message: SubscriptionMessage,
  ) {
    if (!message.deviceId) throw new WsException('Invalid subscription');
    await client.leave(`device:${message.deviceId}`);
    this.metrics.recordWebsocketSubscription('unsubscribed');
    return { type: 'unsubscribed', deviceId: message.deviceId };
  }

  publishLocation(event: {
    deviceId: string;
    eventId: string;
    capturedAt: string;
    latitude: number;
    longitude: number;
  }): void {
    if (!this.server) {
      this.metrics.recordWebsocketDelivery('no_server');
      return;
    }
    this.server.to(`device:${event.deviceId}`).emit('location.updated', event);
    this.metrics.recordWebsocketDelivery('delivered');
  }

  private extractToken(
    value: unknown,
    cookieHeader?: string,
  ): string | undefined {
    if (typeof value === 'string' && value.length > 0) return value;
    const cookie = cookieHeader
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='));
    return cookie
      ? decodeURIComponent(cookie.slice('access_token='.length))
      : undefined;
  }

  private getUserId(client: Socket): string | undefined {
    const data = (client as unknown as { data?: unknown }).data;
    if (!data || typeof data !== 'object') return undefined;
    const userId = (data as { userId?: unknown }).userId;
    return typeof userId === 'string' ? userId : undefined;
  }
}
