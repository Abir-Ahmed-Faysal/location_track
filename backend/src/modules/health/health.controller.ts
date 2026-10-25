import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Exposes process and database probes for orchestrators and load balancers. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns 200 while the API process is able to handle requests. */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Returns 200 only when the database connection can execute a probe query. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok' }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
