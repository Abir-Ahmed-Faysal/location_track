import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '../jwt.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: unknown;
    email?: unknown;
  };
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const payload = this.jwtService.verifyAccessToken(token);
          request.user = {
            id: payload.sub,
            email: payload.email,
          };
        }
      } catch (_e) {
        // Token invalid or expired; continue as unauthenticated SDK device request
      }
    }

    return true;
  }
}
