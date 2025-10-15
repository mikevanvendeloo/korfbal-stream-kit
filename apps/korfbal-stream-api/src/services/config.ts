import dotenv from 'dotenv';
import { z } from 'zod';

type NodeEnv = 'development' | 'test' | 'production' | string;

// Load .env in non-production (safe in production too; values from env take precedence)
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v > 0, 'PORT must be a positive number')
    .default('3333' as unknown as any),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').or(z.string().length(0)).default(''),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // In unit tests we do not enforce DATABASE_URL; other fields use defaults
  const formatted = parsed.error.flatten();
  const messages = Object.entries(formatted.fieldErrors)
    .map(([k, v]) => `${k}: ${v?.join(', ')}`)
    .join('; ');
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Invalid environment configuration: ${messages}`);
  }
}

const env = parsed.success
  ? parsed.data
  : // Fallback with minimal defaults for tests
    ({
      NODE_ENV: (process.env.NODE_ENV || 'test') as NodeEnv,
      PORT: Number(process.env.PORT || 3333),
      DATABASE_URL: process.env.DATABASE_URL || '',
      LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
    } as any);

export const config = {
  nodeEnv: env.NODE_ENV as NodeEnv,
  port: Number(env.PORT),
  databaseUrl: env.DATABASE_URL,
  logLevel: env.LOG_LEVEL,
};

export function requireConfig() {
  if (!config.databaseUrl && config.nodeEnv !== 'test') {
    throw new Error('DATABASE_URL must be set');
  }
  return config;
}
