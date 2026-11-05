import {z} from 'zod';
import type {VenueStatsConfig} from '@korfbal-stream-kit/venue-protocol';

const EnvSchema = z.object({
  /** Read-only root of the statistics PC's share (or a plain local folder); unset: no share */
  STATS_DIR: z.string().default(''),
  COPY_DIR: z.string().default('/data'),
});

export type BridgeConfig = {
  /** Local (machine bound): the share and the folder of the local database copy */
  statsDir: string;
  copyDir: string;
  /** From the venue configuration (the API, or the cache): empty until one is applied */
  pageUrl: string | null;
  mdbPath: string | null;
  mdbEnabled: boolean;
  shareHost: string | null;
  keepCopy: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }
  return {
    statsDir: parsed.data.STATS_DIR,
    copyDir: parsed.data.COPY_DIR,
    pageUrl: null,
    mdbPath: null,
    mdbEnabled: false,
    shareHost: null,
    keepCopy: true,
  };
}

/** The live configuration (module-level so the services read it without passing it around; tests replace it). */
export const config: BridgeConfig = loadConfig(process.env.NODE_ENV === 'test' ? {} : process.env);

/** The statistics part of the venue configuration, applied live (the local folders stay as they are). */
export function applyStatsConfig(stats: VenueStatsConfig): void {
  config.pageUrl = stats.pageUrl;
  config.mdbPath = stats.mdbPath;
  config.mdbEnabled = stats.mdbEnabled;
  config.shareHost = stats.shareHost;
  config.keepCopy = stats.keepCopy;
}

export function setConfigForTests(patch: Partial<BridgeConfig>): void {
  Object.assign(config, patch);
}
