import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtService {
  constructor(private readonly configService: ConfigService) {}

  generateAccessToken(payload: Record<string, unknown>): string {
    const secret = this.configService.get<string>('ACCESS_TOKEN_SECRET');
    const expiresIn =
      this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN') ?? '15m';

    return jwt.sign(payload, secret as jwt.Secret, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: Record<string, unknown>): string {
    const secret = this.configService.get<string>('REFRESH_TOKEN_SECRET');
    const expiresIn =
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d';

    return jwt.sign(payload, secret as jwt.Secret, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): Record<string, unknown> {
    const secret = this.configService.get<string>('ACCESS_TOKEN_SECRET');
    return jwt.verify(token, secret as jwt.Secret) as Record<string, unknown>;
  }

  verifyRefreshToken(token: string): Record<string, unknown> {
    const secret = this.configService.get<string>('REFRESH_TOKEN_SECRET');
    return jwt.verify(token, secret as jwt.Secret) as Record<string, unknown>;
  }
}
