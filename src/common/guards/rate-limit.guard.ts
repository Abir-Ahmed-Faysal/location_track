import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Simple in-memory per-IP limiter for a single API instance. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<
    string,
    { startedAt: number; count: number }
  >();
  private readonly windowMs = 60_000;
  private readonly maxRequests = Math.max(
    1,
    Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '60', 10) || 60,
  );

  /** Allows requests inside the current window and rejects excess traffic. */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const current = this.windows.get(key);
    const window =
      !current || now - current.startedAt >= this.windowMs
        ? { startedAt: now, count: 0 }
        : current;

    window.count += 1;
    this.windows.set(key, window);
    if (window.count <= this.maxRequests) return true;

    const retryAfter = Math.max(
      1,
      Math.ceil((this.windowMs - (now - window.startedAt)) / 1000),
    );
    response.setHeader('Retry-After', retryAfter.toString());
    throw new HttpException(
      'Rate limit exceeded',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
