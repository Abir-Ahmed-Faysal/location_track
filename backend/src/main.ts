import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { APP_CONSTANTS } from './common/constants/app.constants';

class TrustedOriginIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly corsOrigin: boolean | string | string[],
  ) {
    super(app);
  }

  override createIOServer(
    port: number,
    options?: Parameters<IoAdapter['createIOServer']>[1],
  ) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: this.corsOrigin,
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const rawOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    '*'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsOrigin =
    rawOrigins.length === 0 || rawOrigins.includes('*')
      ? true
      : rawOrigins;

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useWebSocketAdapter(new TrustedOriginIoAdapter(app, corsOrigin));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix(APP_CONSTANTS.API_PREFIX, {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });

  await app.listen(process.env.PORT ?? APP_CONSTANTS.DEFAULT_PORT);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
