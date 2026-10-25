import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

/** Simple in-memory per-IP and per-device limiter for a single API instance. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<
    string,
    { startedAt: number; count: number }
  >();
  private readonly windowMs = 60_000;

  constructor(private readonly config: ConfigService) {}

  /** Allows requests inside the current window and rejects excess traffic. */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const maxRequests = Math.max(
      1,
      this.config.get<number>('rateLimit.perMinute', 60),
    );
    const now = Date.now();
    this.pruneExpired(now);
    const keys = this.getKeys(request);
    const windows = keys.map((key) => this.getWindow(key, now));
    const exceeded = windows.find(({ window }) => window.count >= maxRequests);

    if (exceeded) {
      const retryAfter = Math.max(
        1,
        Math.ceil((this.windowMs - (now - exceeded.window.startedAt)) / 1000),
      );
      response.setHeader('Retry-After', retryAfter.toString());
      response.setHeader('X-RateLimit-Limit', maxRequests.toString());
      response.setHeader('X-RateLimit-Remaining', '0');
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    for (const { key, window } of windows) {
      window.count += 1;
      this.windows.set(key, window);
    }
    const remaining = Math.max(
      0,
      ...windows.map(({ window }) => maxRequests - window.count),
    );
    response.setHeader('X-RateLimit-Limit', maxRequests.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    return true;
  }

  private getKeys(request: Request): string[] {
    const keys = new Set<string>([`ip:${request.ip ?? 'unknown'}`]);
    const body = request.body as
      | { deviceId?: unknown; events?: Array<{ deviceId?: unknown }> }
      | undefined;
    const deviceIds = [
      body?.deviceId,
      ...(Array.isArray(body?.events)
        ? body.events.map((event) => event.deviceId)
        : []),
      request.query?.deviceId,
    ];
    for (const deviceId of deviceIds) {
      if (typeof deviceId === 'string' && deviceId.length > 0) {
        keys.add(`device:${deviceId}`);
      }
    }
    return [...keys];
  }

  private getWindow(key: string, now: number) {
    const current = this.windows.get(key);
    const window =
      !current || now - current.startedAt >= this.windowMs
        ? { startedAt: now, count: 0 }
        : current;
    return { key, window };
  }

  private pruneExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) {
        this.windows.delete(key);
      }
    }
  }
}
