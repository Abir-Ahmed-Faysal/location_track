import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../../prisma/prisma.service';
import { AdminSeedService } from './admin-seed.service';

describe('AdminSeedService', () => {
  function createService(values: Record<string, string>, count = 1) {
    const config = { get: jest.fn((key: string) => values[key]) };
    const prisma = { user: { createMany: jest.fn().mockResolvedValue({ count }) } };
    const service = new AdminSeedService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    return { service, prisma };
  }

  it('does nothing when seed credentials are not configured', async () => {
    const { service, prisma } = createService({});
    await service.onApplicationBootstrap();
    expect(prisma.user.createMany).not.toHaveBeenCalled();
  });

  it('creates a hashed ADMIN account and lets the unique email skip existing users', async () => {
    const { service, prisma } = createService({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'long-enough-admin-password',
    });
    await service.onApplicationBootstrap();
    const [args] = prisma.user.createMany.mock.calls[0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data[0]).toMatchObject({ email: 'admin@example.com', name: null, role: 'ADMIN' });
    expect(args.data[0].password).not.toBe('long-enough-admin-password');
    await expect(bcrypt.compare('long-enough-admin-password', args.data[0].password)).resolves.toBe(true);
  });

  it('does not overwrite or promote an account when the configured email already exists', async () => {
    const { service, prisma } = createService({
      ADMIN_EMAIL: 'existing@example.com',
      ADMIN_PASSWORD: 'long-enough-admin-password',
    }, 0);
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(prisma.user.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });
});
