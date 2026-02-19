import dotenv from 'dotenv';
import {z} from 'zod';
import {logger} from "../utils/logger";

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
  SCOREBOARD_BASE_URL: z.string().url().default('http://10.12.0.62/scoreboard'),
  SHOTCLOCK_BASE_URL: z.string().url().default('http://10.12.0.61/shotclock'),
  MATCH_SCHEDULE_BASE_URL: z.string().url().default('https://api.sportclubvrijwilligersmanagement.nl/v1'),
  MATCH_SCHEDULE_API_TOKEN: z.string().optional().or(z.literal('')).default(''),
  // Root directory where binary assets (logos, player photos, uploads) are stored within the container/app.
  // Default: "storage". In tests, if not set, falls back to tmp/test-storage under cwd to avoid polluting real data.
  ASSETS_DIR: z.string().optional().default(''),
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
    SCOREBOARD_BASE_URL: process.env.SCOREBOARD_BASE_URL || 'http://10.12.0.62/scoreboard',
    SHOTCLOCK_BASE_URL: process.env.SHOTCLOCK_BASE_URL || 'http://10.12.0.61/shotclock',
    MATCH_SCHEDULE_BASE_URL: process.env.MATCH_SCHEDULE_BASE_URL || 'https://api.sportclubvrijwilligersmanagement.nl/v1',
    MATCH_SCHEDULE_API_TOKEN: process.env.MATCH_SCHEDULE_API_TOKEN || '',
    ASSETS_DIR: process.env.ASSETS_DIR || '',
  } as any);

export const config = {
  nodeEnv: env.NODE_ENV as NodeEnv,
  port: Number(env.PORT),
  databaseUrl: env.DATABASE_URL,
  logLevel: env.LOG_LEVEL,
  scoreBoardBaseUrl: env.SCOREBOARD_BASE_URL as string,
  shotClockBaseUrl: env.SHOTCLOCK_BASE_URL as string,
  matchScheduleBaseUrl: env.MATCH_SCHEDULE_BASE_URL as string,
  matchScheduleApiToken: ((env.MATCH_SCHEDULE_API_TOKEN || '') as string),
  assetsDir: (env.ASSETS_DIR || '') as string,
};

export function requireConfig() {
  if (!config.databaseUrl && config.nodeEnv !== 'test') {
    throw new Error('DATABASE_URL must be set');
  }
  if (!config.matchScheduleApiToken && config.nodeEnv !== 'test') {
    throw new Error('MATCH_SCHEDULE_API_TOKEN must be set');
  }
  return config;
}

export function logConfig() {
  logger.info('Config:', {
    ...config,
    databaseUrl: config.databaseUrl ? config.databaseUrl.replace(/\/.*@/g, '***:***@') : 'not set',
    matchScheduleApiToken: config.matchScheduleApiToken ? '***' : 'not set',
    assetsDir: getAssetsRoot(),
  })
}

// Returns absolute path to the assets root directory, ensuring a sensible default in tests.
export function getAssetsRoot(): string {
  const pathModule = require('node:path') as typeof import('node:path');
  const fs = require('node:fs') as typeof import('node:fs');
  // If explicitly configured, use as is (absolute or relative to cwd)
  let dir = (config.assetsDir || '').trim();
  if (!dir) {
    if (config.nodeEnv === 'test') {
      dir = pathModule.join(process.cwd(), 'tmp', 'test-storage');
    } else {
      dir = 'storage';
    }
  }
  const abs = pathModule.isAbsolute(dir) ? dir : pathModule.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  return abs;
}
