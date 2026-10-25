import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

/** Creates a configured initial administrator once, without changing existing accounts. */
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) return;

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.prisma.user.createMany({
      data: [{
        email,
        password: passwordHash,
        name: null,
        role: 'ADMIN',
      }],
      skipDuplicates: true,
    });

    if (result.count === 0) {
      this.logger.log('Admin seed skipped because the configured email already exists.');
      return;
    }
    this.logger.log('Initial admin account created from environment configuration.');
  }
}
