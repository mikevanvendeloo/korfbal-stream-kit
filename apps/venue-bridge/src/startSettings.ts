import {z} from 'zod';

const EnvSchema = z.object({
  API_URL: z.string({error: 'API_URL ontbreekt'}).trim().min(1, 'API_URL ontbreekt').url('API_URL is geen geldig adres'),
  API_KEY: z.string({error: 'API_KEY ontbreekt'}).trim().min(1, 'API_KEY ontbreekt'),
  BRIDGE_NAME: z.string().trim().max(80).default('venue-bridge'),
  /** The address of this bridge's page on the venue network, shown in the kit (optional) */
  BRIDGE_PAGE_URL: z.string().trim().max(300).default(''),
  PORT: z.coerce.number().int().min(1).max(65535).default(3340),
  HOST: z.string().trim().default('0.0.0.0'),
  CONFIG_FILE: z.string().trim().default('/data/venue-bridge.json'),
  LOG_LEVEL: z.string().trim().default('info'),
});

/** What the bridge needs locally to start; everything about the venue itself comes from the API. */
export type StartSettings = {
  apiUrl: string;
  /** Never log this */
  apiKey: string;
  name: string;
  pageUrl: string | null;
  port: number;
  host: string;
  configFile: string;
  logLevel: string;
};

export class StartSettingsError extends Error {}

export function loadStartSettings(env: NodeJS.ProcessEnv = process.env): StartSettings {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Only the messages of the settings, never their values (the key stays out of the log)
    throw new StartSettingsError(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const e = parsed.data;
  return {
    apiUrl: e.API_URL.replace(/\/+$/, ''),
    apiKey: e.API_KEY,
    name: e.BRIDGE_NAME,
    pageUrl: e.BRIDGE_PAGE_URL || null,
    port: e.PORT,
    host: e.HOST,
    configFile: e.CONFIG_FILE,
    logLevel: e.LOG_LEVEL,
  };
}

/** Host of the API address for the log: no path, no credentials. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'onbekend';
  }
}
