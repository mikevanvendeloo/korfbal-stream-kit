import {io, type Socket} from 'socket.io-client';
import {
  ConfigApplyRequestSchema, StatsRequestSchema, VENUE_BRIDGE_NAMESPACE, VENUE_EVENTS, VmixCallRequestSchema, VmixInputsRequestSchema,
  type ConfigApplyAnswer, type StatsAnswer, type VenueReading, type VmixCallAnswer, type VmixInputsAnswer,
} from '@korfbal-stream-kit/venue-protocol';
import {logger} from '../logger';
import {hostOf, type StartSettings} from '../startSettings';

export const RECONNECT_MIN_MS = 1000;
export const RECONNECT_MAX_MS = 30000;

export type ApiHandlers = {
  applyConfig: (raw: unknown) => ConfigApplyAnswer;
  statsRequest: (path: string) => Promise<StatsAnswer>;
  vmixCall: (request: ReturnType<typeof VmixCallRequestSchema.parse>) => Promise<VmixCallAnswer>;
  vmixInputs: (request: ReturnType<typeof VmixInputsRequestSchema.parse>) => Promise<VmixInputsAnswer>;
  /** Called after each (re)connect, to send the current readings again */
  onConnected: () => void;
};

export type ApiState = {connected: boolean; since: string | null; error: string | null};

const BAD_REQUEST = {ok: false as const, error: 'Ongeldig verzoek'};

/** The outbound connection to the API's venue-bridge namespace. Never logs the key. */
export class ApiConnection {
  private socket: Socket | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private failures = 0;
  private current: ApiState = {connected: false, since: null, error: null};

  constructor(
    private readonly settings: Pick<StartSettings, 'apiUrl' | 'apiKey' | 'name' | 'pageUrl'>,
    private readonly version: string,
    private readonly handlers: ApiHandlers,
  ) {}

  get state(): ApiState {
    return this.current;
  }

  start(): void {
    if (this.socket) return;
    const socket = io(`${this.settings.apiUrl}${VENUE_BRIDGE_NAMESPACE}`, {
      auth: {key: this.settings.apiKey, name: this.settings.name, version: this.version, pageUrl: this.settings.pageUrl},
      reconnection: true,
      reconnectionDelay: RECONNECT_MIN_MS,
      reconnectionDelayMax: RECONNECT_MAX_MS,
      randomizationFactor: 0.2,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.failures = 0;
      this.current = {connected: true, since: new Date().toISOString(), error: null};
      logger.info('Verbonden met de API', {api: hostOf(this.settings.apiUrl)});
      this.handlers.onConnected();
    });
    socket.on('disconnect', (reason) => {
      this.current = {connected: false, since: null, error: this.current.error};
      logger.warn('Verbinding met de API verbroken', {reason});
      // The server closing the socket on purpose does not reconnect by itself
      if (!socket.active) this.scheduleRetry();
    });
    socket.on('connect_error', (err: Error & {data?: {code?: string}}) => {
      const code = err.data?.code ?? err.message;
      this.failures += 1;
      const refused = code === 'API_KEY_INVALID' || code === 'API_KEY_MISSING';
      this.current = {connected: false, since: null, error: refused ? 'Ongeldige API-sleutel' : 'API niet bereikbaar'};
      // Same line each time; only a refusal gets its reason
      logger.warn('Geen verbinding met de API', {api: hostOf(this.settings.apiUrl), reason: refused ? code : 'niet bereikbaar'});
      // A refused handshake (middleware error) is not retried by socket.io itself
      if (!socket.active) this.scheduleRetry(refused ? RECONNECT_MAX_MS : undefined);
    });

    socket.on(VENUE_EVENTS.configApply, (payload: unknown, ack?: (a: ConfigApplyAnswer) => void) => {
      const parsed = ConfigApplyRequestSchema.safeParse(payload);
      ack?.(parsed.success ? this.handlers.applyConfig(parsed.data.config) : {ok: false, error: BAD_REQUEST.error});
    });
    socket.on(VENUE_EVENTS.statsRequest, async (payload: unknown, ack?: (a: StatsAnswer) => void) => {
      const parsed = StatsRequestSchema.safeParse(payload);
      if (!parsed.success) return ack?.({status: 400, headers: {}, body: {error: BAD_REQUEST.error}});
      try {
        ack?.(await this.handlers.statsRequest(parsed.data.path));
      } catch {
        ack?.({status: 500, headers: {}, body: {error: 'Interne serverfout'}});
      }
    });
    socket.on(VENUE_EVENTS.vmixCall, async (payload: unknown, ack?: (a: VmixCallAnswer) => void) => {
      const parsed = VmixCallRequestSchema.safeParse(payload);
      if (!parsed.success) return ack?.(BAD_REQUEST);
      try {
        ack?.(await this.handlers.vmixCall(parsed.data));
      } catch {
        ack?.({ok: false, error: 'unreachable'});
      }
    });
    socket.on(VENUE_EVENTS.vmixInputs, async (payload: unknown, ack?: (a: VmixInputsAnswer) => void) => {
      const parsed = VmixInputsRequestSchema.safeParse(payload);
      if (!parsed.success) return ack?.(BAD_REQUEST);
      try {
        ack?.(await this.handlers.vmixInputs(parsed.data));
      } catch {
        ack?.({ok: false, error: 'unreachable'});
      }
    });
  }

  /** Sends a reading when connected; nothing is buffered, the next round sends a fresh one. */
  sendReading(reading: VenueReading): void {
    if (this.socket?.connected) this.socket.emit(VENUE_EVENTS.reading, reading);
  }

  stop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.disconnect();
    this.socket?.removeAllListeners();
    this.socket = null;
  }

  private scheduleRetry(delay?: number): void {
    if (this.retryTimer || !this.socket) return;
    const wait = delay ?? Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** Math.min(this.failures, 5));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.socket?.connect();
    }, wait);
  }
}
