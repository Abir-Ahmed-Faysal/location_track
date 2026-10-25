import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      route?: { path?: string };
      originalUrl?: string;
    }>();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode?: number }>();
    const started = process.hrtime.bigint();
    return next.handle().pipe(
      finalize(() => {
        const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
        this.metrics.recordHttpLatency(
          request.method ?? 'UNKNOWN',
          request.route?.path ?? request.originalUrl ?? 'unknown',
          response.statusCode ?? 0,
          elapsed,
        );
      }),
    );
  }
}
