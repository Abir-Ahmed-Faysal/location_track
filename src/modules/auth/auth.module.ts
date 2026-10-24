import { Module } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, JwtService, AuthGuard],
  exports: [AuthGuard, AuthService, JwtService],
})
export class AuthModule {}
