/* eslint-disable prettier/prettier */
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  PORT: z.coerce.number(),

  NODE_ENV: z.enum([
    "development",
    "production",
    "test",
  ]),

  ACCESS_TOKEN_SECRET: z.string().min(32),

  REFRESH_TOKEN_SECRET: z.string().min(32),

  ACCESS_TOKEN_EXPIRES_IN: z.string(),

  REFRESH_TOKEN_EXPIRES_IN: z.string(),

  FRONTEND_URL: z.string().url(),

  EMAIL_SENDER_SMTP_HOST: z.string(),

  EMAIL_SENDER_SMTP_PORT: z.coerce.number(),

  EMAIL_SENDER_SMTP_USER: z.string(),

  EMAIL_SENDER_SMTP_PASS: z.string(),

  EMAIL_SENDER_SMTP_FROM: z.string(),
});

export const validate = (
  config: Record<string, unknown>,
) => {
  return envSchema.parse(config);
};