import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof responseBody === 'string'
        ? responseBody
        : responseBody &&
            typeof responseBody === 'object' &&
            'message' in responseBody
          ? String(responseBody.message)
          : 'Internal server error';
    const details =
      responseBody &&
      typeof responseBody === 'object' &&
      'message' in responseBody &&
      Array.isArray(responseBody.message)
        ? responseBody.message.map((detail, index) => ({
            field: `request.${index}`,
            reason: String(detail),
          }))
        : [];
    const requestId = randomUUID();

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      error: {
        code:
          status === 400
            ? 'VALIDATION_ERROR'
            : status === 401
              ? 'UNAUTHORIZED'
              : status === 404
                ? 'NOT_FOUND'
                : status === 429
                  ? 'RATE_LIMIT_EXCEEDED'
                  : 'HTTP_ERROR',
        message,
        requestId,
        details,
      },
    });
    response.setHeader('X-Request-Id', requestId);
  }
}
