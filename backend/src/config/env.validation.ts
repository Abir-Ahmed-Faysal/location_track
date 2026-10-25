import { z } from 'zod';

const postgresUrl = /^postgres(?:ql)?:\/\//i;
const weakSecret = (value: string): boolean =>
  value.length < 32 ||
  /replace-with|change-me|local-development|example|password|secret/i.test(
    value,
  ) ||
  new Set(value).size < 8;

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),

    PORT: z.coerce.number().int().positive(),

    NODE_ENV: z.enum(['development', 'production', 'test']),

    ACCESS_TOKEN_SECRET: z.string().min(1),

    REFRESH_TOKEN_SECRET: z.string().min(1),

    ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),

    REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),

    FRONTEND_URL: z.string().url().optional(),
    FRONTEND_URLS: z.string().optional(),

    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),

    PROMETHEUS_ENABLED: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((value, context) => {
    const origins = (value.FRONTEND_URLS?.split(',') ?? [value.FRONTEND_URL])
      .map((origin) => origin?.trim())
      .filter((origin): origin is string => Boolean(origin));
    if (origins.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['FRONTEND_URLS'],
        message: 'At least one trusted frontend origin is required',
      });
    }
    if (!postgresUrl.test(value.DATABASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must be a PostgreSQL connection URL',
      });
    }
    if (value.NODE_ENV === 'production') {
      if (weakSecret(value.ACCESS_TOKEN_SECRET)) {
        context.addIssue({
          code: 'custom',
          path: ['ACCESS_TOKEN_SECRET'],
          message: 'A unique high-entropy production secret is required',
        });
      }
      if (weakSecret(value.REFRESH_TOKEN_SECRET)) {
        context.addIssue({
          code: 'custom',
          path: ['REFRESH_TOKEN_SECRET'],
          message: 'A unique high-entropy production secret is required',
        });
      }
      if (value.ACCESS_TOKEN_SECRET === value.REFRESH_TOKEN_SECRET) {
        context.addIssue({
          code: 'custom',
          path: ['REFRESH_TOKEN_SECRET'],
          message: 'Access and refresh secrets must differ',
        });
      }
      if (!value.FRONTEND_URLS) {
        context.addIssue({
          code: 'custom',
          path: ['FRONTEND_URLS'],
          message: 'Production requires explicit FRONTEND_URLS',
        });
      }
      if (origins.some((origin) => !origin.startsWith('https://'))) {
        context.addIssue({
          code: 'custom',
          path: ['FRONTEND_URLS'],
          message: 'Production frontend origins must use HTTPS',
        });
      }
      if (
        /localhost|127\.0\.0\.1|postgres:postgres/i.test(value.DATABASE_URL)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['DATABASE_URL'],
          message:
            'Production DATABASE_URL must not point to local/default credentials',
        });
      }
    }
  });

export const validate = (config: Record<string, unknown>) =>
  envSchema.parse(config);
