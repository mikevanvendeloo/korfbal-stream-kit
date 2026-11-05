import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {VenueConfigSchema, type VenueConfig} from '@korfbal-stream-kit/venue-protocol';
import {z} from 'zod';
import {applyStatsConfig} from '../config';
import {logger} from '../logger';

const CacheFileSchema = z.object({
  config: VenueConfigSchema,
  receivedAt: z.string().datetime(),
  /** The statistics team the API asked for last; the fallback API uses it */
  statsTeam: z.string().regex(/^\d{1,2}$/).optional(),
});

export type ConfigSource = 'api' | 'cache';
export type ConfigState = {
  state: 'none' | 'applied';
  source: ConfigSource | null;
  version: string | null;
  receivedAt: string | null;
};

export type ApplyResult = {ok: true} | {ok: false; error: string};

/**
 * The venue configuration: validated before it is applied, applied live, kept in a cache file (temporary file and
 * rename, mode 600) so the venue keeps working while the API is out of reach.
 */
export class ConfigCache extends EventEmitter {
  private current: VenueConfig | null = null;
  private receivedAt: string | null = null;
  private source: ConfigSource | null = null;
  private team: string | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {
    super();
  }

  get config(): VenueConfig | null {
    return this.current;
  }

  get statsTeam(): string {
    return this.team ?? '1';
  }

  get state(): ConfigState {
    return {state: this.current ? 'applied' : 'none', source: this.source, version: this.current?.version ?? null, receivedAt: this.receivedAt};
  }

  /** Applies the cache file at start. An invalid or unreadable file leaves the bridge without configuration. */
  loadFromFile(): boolean {
    let raw: string;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') logger.warn('Configuratie ongeldig: cachebestand onleesbaar', {reason: (err as Error).message});
      return false;
    }
    try {
      const parsed = CacheFileSchema.parse(JSON.parse(raw));
      this.team = parsed.statsTeam;
      this.set(parsed.config, 'cache', parsed.receivedAt);
      return true;
    } catch (err) {
      const reason = err instanceof z.ZodError ? err.issues[0]?.message : (err as Error).message;
      logger.warn('Configuratie ongeldig: cachebestand wordt niet gebruikt', {reason});
      return false;
    }
  }

  /** A configuration from the API: refused when invalid (the reason goes back to the API), else applied and cached. */
  apply(raw: unknown): ApplyResult {
    const parsed = VenueConfigSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const error = `${issue?.path.join('.') || 'config'}: ${issue?.message ?? 'ongeldig'}`;
      logger.warn('Configuratie ongeldig: van de API geweigerd', {reason: error});
      return {ok: false, error};
    }
    this.set(parsed.data, 'api', new Date().toISOString());
    void this.write();
    return {ok: true};
  }

  /** Remembers the team the API asked for, for the fallback API. */
  rememberTeam(team: string): void {
    if (team === this.team || !/^\d{1,2}$/.test(team)) return;
    this.team = team;
    if (this.current) void this.write();
  }

  /** Resolves when the running cache write is done (tests). */
  flush(): Promise<void> {
    return this.writing;
  }

  private set(config: VenueConfig, source: ConfigSource, receivedAt: string): void {
    this.current = config;
    this.source = source;
    this.receivedAt = receivedAt;
    applyStatsConfig(config.stats);
    this.emit('change', config);
  }

  private write(): Promise<void> {
    this.writing = this.writing.then(async () => {
      if (!this.current || !this.receivedAt) return;
      const tmp = `${this.file}.${process.pid}.tmp`;
      try {
        await fs.promises.mkdir(path.dirname(this.file), {recursive: true});
        const body = JSON.stringify({config: this.current, receivedAt: this.receivedAt, statsTeam: this.team});
        await fs.promises.writeFile(tmp, body, {mode: 0o600});
        await fs.promises.chmod(tmp, 0o600);
        await fs.promises.rename(tmp, this.file);
      } catch (err) {
        // The configuration is applied anyway; only the cache is missing
        logger.warn('Configuratie niet in het cachebestand gezet', {reason: (err as Error).message});
        await fs.promises.rm(tmp, {force: true}).catch(() => undefined);
      }
    });
    return this.writing;
  }
}
