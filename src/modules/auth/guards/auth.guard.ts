import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth.service';
import { JwtService } from '../jwt.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: unknown;
    email?: unknown;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    const authHeader = request.headers.authorization;
    const accessToken = this.extractBearerToken(authHeader);
    const accessTokenFromCookie = this.getCookieValue(request.headers.cookie, 'access_token');
    const refreshToken = this.getCookieValue(request.headers.cookie, 'refresh_token');

    if (accessToken || accessTokenFromCookie) {
      try {
        const tokenToVerify = accessToken ?? accessTokenFromCookie;
        const payload = this.jwtService.verifyAccessToken(tokenToVerify as string);
        request.user = {
          id: payload.sub,
          email: payload.email,
        };
        return true;
      } catch {
        if (!refreshToken) {
          throw new UnauthorizedException('Invalid or expired access token');
        }
      }
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Authorization required');
    }

    try {
      const result = await this.authService.refresh(
        { refreshToken },
        request.headers['user-agent'],
        request.ip,
      );

      this.setAuthCookies(response, result);

      const payload = this.jwtService.verifyAccessToken(result.accessToken);
      request.user = {
        id: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private extractBearerToken(authorization?: string): string | undefined {
    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }

  private getCookieValue(cookieHeader: string | undefined, cookieName: string): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }

    const cookie = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${cookieName}=`));

    if (!cookie) {
      return undefined;
    }

    return decodeURIComponent(cookie.slice(cookieName.length + 1));
  }

  private setAuthCookies(response: Response, tokens: { accessToken: string; refreshToken: string }) {
    response.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
}
