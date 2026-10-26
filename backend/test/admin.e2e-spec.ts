/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import crypto from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies ordinary users and exposes authorized fleet data to admins', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const password = 'AdminDashboardPassword123!';
    const ownerEmail = `owner-${suffix}@example.com`;
    const adminEmail = `admin-${suffix}@example.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: ownerEmail, password, name: 'Device Owner' })
      .expect(201);
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(201);
    const ownerAuth = { Authorization: `Bearer ${ownerLogin.body.accessToken}` };

    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: adminEmail, password, name: 'Fleet Admin' })
      .expect(201);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(201);
    const adminAuth = { Authorization: `Bearer ${adminLogin.body.accessToken}` };

    await request(app.getHttpServer())
      .get('/api/v1/auth/profile')
      .set(adminAuth)
      .expect(200)
      .expect((response) => expect(response.body.role).toBe('ADMIN'));
    await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .set(ownerAuth)
      .expect(403);

    const device = await request(app.getHttpServer())
      .post('/api/v1/devices/register')
      .set(ownerAuth)
      .send({ externalDeviceKey: `admin-e2e-${suffix}`, platform: 'ANDROID' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/devices/${device.body.id}/status`)
      .set(adminAuth)
      .send({ status: 'ACTIVE' })
      .expect(200);
    const eventId = crypto.randomUUID();
    const capturedAt = new Date().toISOString();
    await request(app.getHttpServer())
      .post('/api/v1/locations/batch')
      .set(ownerAuth)
      .send({
        schemaVersion: 1,
        events: [
          {
            eventId,
            deviceId: device.body.id,
            capturedAt,
            latitude: 23.8103,
            longitude: 90.4125,
            accuracyM: 6,
            speedMps: 2.5,
          },
        ],
      })
      .expect(201);

    const devices = await request(app.getHttpServer())
      .get('/api/v1/admin/devices')
      .query({ search: `admin-e2e-${suffix}`, page: 1, limit: 10 })
      .set(adminAuth)
      .expect(200);
    expect(devices.body.total).toBe(1);
    expect(devices.body.items[0].owner.email).toBe(ownerEmail);
    expect(devices.body.items[0].latestLocation.speedMps).toBe(2.5);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/admin/devices/${device.body.id}/locations/history`)
      .query({ from: capturedAt, to: capturedAt, limit: 5 })
      .set(adminAuth)
      .expect(200);
    expect(history.body.items.map((event: { eventId: string }) => event.eventId)).toContain(eventId);

    await request(app.getHttpServer())
      .get('/api/v1/admin/devices')
      .set(ownerAuth)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/devices')
      .expect(401);
  });
});
