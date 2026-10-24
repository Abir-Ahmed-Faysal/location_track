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
});

export const validate = (
  config: Record<string, unknown>,
) => {
  return envSchema.parse(config);
};