/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import crypto from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';

describe('Realtime gateway (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('authenticates, subscribes, delivers, de-duplicates, and reconnects', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `ws-${suffix}@example.com`;
    const password = 'WebsocketPassword123!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password, name: 'Realtime User' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const token = login.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };
    const device = await request(app.getHttpServer())
      .post('/api/v1/devices/register')
      .set(auth)
      .send({ externalDeviceKey: `ws-${suffix}`, platform: 'ANDROID' })
      .expect(201);
    const deviceId = device.body.id as string;
    const url = await app.getUrl();
    const socket = io(`${url}/ws/v1/locations`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
    const received: unknown[] = [];
    socket.on('location.updated', (event) => received.push(event));
    await once(socket, 'connect');
    const subscription = await emitWithAck(socket, 'subscribe', { deviceId });
    expect(subscription).toEqual({ type: 'subscribed', deviceId });

    const eventId = crypto.randomUUID();
    const event = {
      eventId,
      deviceId,
      capturedAt: new Date().toISOString(),
      latitude: 23.8103,
      longitude: 90.4125,
      accuracyM: 5,
    };
    await request(app.getHttpServer())
      .post('/api/v1/locations/batch')
      .set(auth)
      .send({ schemaVersion: 1, events: [event] })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/locations/batch')
      .set(auth)
      .send({ schemaVersion: 1, events: [event] })
      .expect(201);
    await waitFor(() => received.length === 1);
    expect((received[0] as { eventId: string }).eventId).toBe(eventId);

    const disconnected = once(socket, 'disconnect');
    socket.disconnect();
    await disconnected;
    socket.connect();
    await once(socket, 'connect');
    await emitWithAck(socket, 'subscribe', { deviceId });
    socket.disconnect();

    await app.close();
    app = await createApp();
    const restartedSocket = io(`${await app.getUrl()}/ws/v1/locations`, {
      auth: { token },
      transports: ['websocket'],
    });
    await once(restartedSocket, 'connect');
    const restartedSubscription = await emitWithAck(
      restartedSocket,
      'subscribe',
      { deviceId },
    );
    expect(restartedSubscription).toEqual({ type: 'subscribed', deviceId });
    restartedSocket.disconnect();
  }, 30000);
});

async function createApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const application = moduleFixture.createNestApplication();
  application.setGlobalPrefix('api/v1');
  await application.listen(0);
  return application;
}

function once(socket: Socket, event: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      10000,
    );
    socket.once(event, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function emitWithAck(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event} ack`)),
      10000,
    );
    socket.emit(event, payload, (value: unknown) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw new Error('Timed out waiting for realtime event');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
