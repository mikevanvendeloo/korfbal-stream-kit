import {z} from 'zod';

const bool = (fallback: boolean) =>
  z.preprocess((v) => (v === undefined || v === '' ? fallback : String(v).toLowerCase() === 'true'), z.boolean());

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3340),
  /** Read-only root of the statistics PC's share (or a plain local folder); unset: no share */
  STATS_DIR: z.string().default(''),
  /** http(s) address of the "Tweede Scherm klassiek" page, or a relative .html path inside STATS_DIR */
  PAGE_URL: z.string().trim().default('').refine((v) => v === '' || /^https?:\/\/[^\s/]+/i.test(v) || (!/^([a-z]:|[\\/])/i.test(v) && !v.split(/[\\/]+/).includes('..') && /\.html?$/i.test(v)), 'PAGE_URL must be an http(s) URL or a relative .html path'),
  /** Path of WEDSTRIJDEN.mdb inside STATS_DIR; may contain {team} */
  MDB_PATH: z.string().trim().default('').refine((v) => v === '' || (!/^([a-z]:|[\\/])/i.test(v) && !v.split(/[\\/]+/).includes('..') && /\.(mdb|accdb)$/i.test(v)), 'MDB_PATH must be a relative .mdb/.accdb path'),
  /** false: never touch STATS_DIR, the share or the copy; only the HTML page is used */
  MDB_ENABLED: bool(true),
  /** The statistics PC (IP or name) for the SMB port probe; else the host of PAGE_URL */
  SHARE_HOST: z.string().trim().default(''),
  KEEP_COPY: bool(true),
  COPY_DIR: z.string().default('/data'),
  /** Optional shared secret: every route but /health needs header X-Bridge-Token */
  BRIDGE_TOKEN: z.string().default(''),
});

export type BridgeConfig = {
  port: number;
  statsDir: string;
  pageUrl: string | null;
  mdbPath: string | null;
  mdbEnabled: boolean;
  shareHost: string | null;
  keepCopy: boolean;
  copyDir: string;
  bridgeToken: string | null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }
  const e = parsed.data;
  return {
    port: e.PORT,
    statsDir: e.STATS_DIR,
    pageUrl: e.PAGE_URL || null,
    mdbPath: e.MDB_PATH || null,
    mdbEnabled: e.MDB_ENABLED,
    shareHost: e.SHARE_HOST || null,
    keepCopy: e.KEEP_COPY,
    copyDir: e.COPY_DIR,
    bridgeToken: e.BRIDGE_TOKEN || null,
  };
}

/** The live configuration (module-level so the services read it without passing it around; tests replace it). */
export const config: BridgeConfig = loadConfig(process.env.NODE_ENV === 'test' ? {} : process.env);

export function setConfigForTests(patch: Partial<BridgeConfig>): void {
  Object.assign(config, patch);
}
