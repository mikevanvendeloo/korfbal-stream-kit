import axios from 'axios';
import {MAX_READING_BYTES, MAX_READING_ITEMS, type VenueConfig, type VenueDevice, type VenueReading} from '@korfbal-stream-kit/venue-protocol';
import {logger} from '../logger';

export const ROUND_MS = 1000;
/** A wall-clock deadline per request, shorter than the round (axios' `timeout` is an idle timeout). */
export const REQUEST_DEADLINE_MS = 800;
/** Every reading is sent again at least this often, so the API can tell a quiet device from a lost one. */
export const RESEND_MS = 5000;

const DEVICE_PATHS: Record<VenueDevice, {device: 'scoreboard' | 'shotclock'; path: string}> = {
  score: {device: 'scoreboard', path: 'score-as-array'},
  clock: {device: 'scoreboard', path: 'time-as-array'},
  shotclock: {device: 'shotclock', path: 'time-as-array'},
};
const DEVICES = Object.keys(DEVICE_PATHS) as VenueDevice[];

type Sent = {key: string; at: number};

export type DeviceReadersOptions = {
  /** The configuration of the moment (from the cache); none: nothing is read */
  getConfig: () => VenueConfig | null;
  /** A reading that changed, or one that is due again */
  onReading: (reading: VenueReading) => void;
};

function deviceUrl(config: VenueConfig | null, device: VenueDevice): string | null {
  const url = config?.[DEVICE_PATHS[device].device].url;
  return url ? `${url.replace(/\/$/, '')}/${DEVICE_PATHS[device].path}` : null;
}

async function read(url: string): Promise<Omit<VenueReading, 'device' | 'readAt'>> {
  try {
    const response = await axios.get(url, {signal: AbortSignal.timeout(REQUEST_DEADLINE_MS), maxContentLength: MAX_READING_BYTES});
    const data: unknown = response.data;
    if (!Array.isArray(data) || data.length > MAX_READING_ITEMS) return {ok: false, data: [], error: 'invalid'};
    return {ok: true, data};
  } catch (err) {
    // Too big is not a scoreboard answer; everything else (refused, deadline, status) is unreachable
    if (axios.isAxiosError(err) && /maxContentLength/i.test(err.message)) return {ok: false, data: [], error: 'invalid'};
    logger.debug('Venue device not reachable', {device: new URL(url).host, error: (err as Error)?.message});
    return {ok: false, data: [], error: 'unreachable'};
  }
}

/**
 * Reads the scoreboard (score, clock) and shot clock once per round. A device still busy from the last round is
 * skipped. A reading goes out when it differs from the last one sent and again every RESEND_MS.
 */
export class DeviceReaders {
  private timer: NodeJS.Timeout | null = null;
  private readonly busy = new Set<VenueDevice>();
  private readonly sent = new Map<VenueDevice, Sent>();
  private readonly latestReadings = new Map<VenueDevice, VenueReading>();

  constructor(private readonly options: DeviceReadersOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.round(), ROUND_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** The last reading per device (also when it was not sent), for the fallback API and the status. */
  latest(device: VenueDevice): VenueReading | null {
    return this.latestReadings.get(device) ?? null;
  }

  /** Forget what was sent, so the next round sends every reading (a new API connection). */
  resendAll(): void {
    this.sent.clear();
  }

  /** One round. Resolves when every device answered or hit its deadline. */
  async round(): Promise<void> {
    await Promise.all(DEVICES.map((device) => this.readDevice(device)));
  }

  private async readDevice(device: VenueDevice): Promise<void> {
    if (this.busy.has(device)) return;
    const config = this.options.getConfig();
    const url = deviceUrl(config, device);
    this.busy.add(device);
    try {
      const result = url ? await read(url) : {ok: false, data: [], error: 'not-configured' as const};
      this.deliver({device, ...result, readAt: new Date().toISOString()}, url ?? '');
    } finally {
      this.busy.delete(device);
    }
  }

  private deliver(reading: VenueReading, url: string): void {
    this.latestReadings.set(reading.device, reading);
    // The url is part of the key: a changed address is sent at once
    const key = JSON.stringify([url, reading.ok, reading.data, reading.error ?? null]);
    const last = this.sent.get(reading.device);
    const now = Date.now();
    if (last && last.key === key && now - last.at < RESEND_MS) return;
    this.sent.set(reading.device, {key, at: now});
    this.options.onReading(reading);
  }
}
