import { Module } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthGuard } from './guards/auth.guard';
import { LocalAuthAdapter } from './local-auth.adapter';
import { AUTH_ADAPTER } from '../../core/ports/auth.port';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    AuthGuard,
    LocalAuthAdapter,
    { provide: AUTH_ADAPTER, useExisting: LocalAuthAdapter },
  ],
  exports: [AuthGuard, AuthService, JwtService],
})
export class AuthModule {}
