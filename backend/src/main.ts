import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { APP_CONSTANTS } from './common/constants/app.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const trustedOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: trustedOrigins,
    credentials: true,
  });

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
