/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import crypto from 'node:crypto';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/api/v1/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('protects location reads from unauthenticated clients', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations/latest')
      .query({ deviceId: '00000000-0000-4000-8000-000000000001' })
      .expect(401);
  });

  it('ingests and reads a location for an authenticated device', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `e2e-${suffix}@example.com`;
    const password = 'SmokePassword123!';
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password, name: 'E2E User' })
      .expect(201);
    expect(signup.body.user.email).toBe(email);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    const device = await request(app.getHttpServer())
      .post('/api/v1/devices/register')
      .set(auth)
      .send({ externalDeviceKey: `e2e-${suffix}`, platform: 'ANDROID' })
      .expect(201);
    const eventId = crypto.randomUUID();

    const batch = {
      schemaVersion: 1,
      events: [
        {
          eventId,
          deviceId: device.body.id,
          capturedAt: new Date().toISOString(),
          latitude: 23.8103,
          longitude: 90.4125,
          accuracyM: 10,
        },
      ],
    };

    const concurrentResults = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/locations/batch')
        .set(auth)
        .send(batch)
        .expect(201),
      request(app.getHttpServer())
        .post('/api/v1/locations/batch')
        .set(auth)
        .send(batch)
        .expect(201),
    ]);
    const acceptedCount = concurrentResults.filter((result) =>
      result.body.accepted.includes(eventId),
    ).length;
    const duplicateCount = concurrentResults.filter((result) =>
      result.body.duplicates.includes(eventId),
    ).length;
    expect(acceptedCount).toBe(1);
    expect(duplicateCount).toBe(1);

    await request(app.getHttpServer())
      .get('/api/v1/locations/history')
      .set(auth)
      .query({ deviceId: device.body.id })
      .expect(200)
      .expect((response) => expect(response.body.items).toHaveLength(1));

    await request(app.getHttpServer())
      .get('/api/v1/locations/latest')
      .set(auth)
      .query({ deviceId: device.body.id })
      .expect(200)
      .expect((response) => expect(response.body.eventId).toBe(eventId));

    await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set(auth)
      .expect(200)
      .expect((response) => {
        expect(response.body.eventsAcceptedTotal).toBeGreaterThanOrEqual(1);
        expect(response.body.ingestionLatencyMsLast).toBeGreaterThanOrEqual(0);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
