import { Injectable } from '@nestjs/common';
import { JwtService } from './jwt.service';
import {
  AuthAdapter,
  AuthContext,
  AuthCredentials,
} from '../../core/ports/auth.port';

/** Default JWT-backed adapter; deployments can replace the AUTH_ADAPTER token. */
@Injectable()
export class LocalAuthAdapter implements AuthAdapter {
  constructor(private readonly jwtService: JwtService) {}

  validateCredentials(
    credentials: AuthCredentials,
  ): Promise<AuthContext | null> {
    if (!credentials.bearerToken) return Promise.resolve(null);
    try {
      const payload = this.jwtService.verifyAccessToken(
        credentials.bearerToken,
      );
      return Promise.resolve({
        type: 'user',
        subjectId: payload.sub as string,
        permissions: ['locations:read', 'locations:write'],
      });
    } catch {
      return Promise.resolve(null);
    }
  }

  hasPermission(context: AuthContext, permission: string): boolean {
    return context.permissions.includes(permission);
  }
}
