import 'dotenv/config';
import { z } from 'zod';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  COMPANY_TIMEZONE: z.string().min(1).default('Europe/Belgrade'),
  WORKING_HOURS_START: z.string().regex(timePattern).default('08:00'),
  WORKING_HOURS_END: z.string().regex(timePattern).default('17:00'),

  ADMIN_SEED_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_SEED_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  USER_SEED_EMAIL: z.string().email().default('user@example.com'),
  USER_SEED_PASSWORD: z.string().min(8).default('ChangeMe123!'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
