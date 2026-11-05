import type {VenueConfig, VenueDevice} from '@korfbal-stream-kit/venue-protocol';
import type {ApiState} from './apiConnection';
import type {ConfigState} from './configCache';
import type {DeviceReaders} from './deviceReaders';
import {hostOf} from '../startSettings';
import type {VmixClient} from './vmixClient';

export const STATUS_READING_CURRENT_MS = 10_000;

export type DeviceState = 'ok' | 'unreachable' | 'invalid' | 'not-configured' | 'unknown';

export type BridgeStatusParts = {
  name: string;
  version: string;
  readers: DeviceReaders;
  vmix: VmixClient;
  getApi: () => ApiState;
  getConfigState: () => ConfigState;
  getConfig: () => VenueConfig | null;
};

const DEVICES: VenueDevice[] = ['score', 'clock', 'shotclock'];

export function deviceStates(readers: DeviceReaders, now = Date.now()): Record<VenueDevice, {state: DeviceState; ageMs: number | null}> {
  const entries = DEVICES.map((device) => {
    const reading = readers.latest(device);
    if (!reading) return [device, {state: 'unknown' as DeviceState, ageMs: null}] as const;
    return [device, {state: (reading.ok ? 'ok' : reading.error ?? 'unreachable') as DeviceState, ageMs: Math.max(0, now - Date.parse(reading.readAt))}] as const;
  });
  return Object.fromEntries(entries) as Record<VenueDevice, {state: DeviceState; ageMs: number | null}>;
}

/** For the page: no key, no device or vMix addresses beyond host names. */
export function buildStatus(parts: BridgeStatusParts, now = Date.now()) {
  const config = parts.getConfig();
  const api = parts.getApi();
  return {
    name: parts.name,
    version: parts.version,
    api: {connected: api.connected, since: api.since, error: api.error},
    config: parts.getConfigState(),
    devices: deviceStates(parts.readers, now),
    hosts: {
      scoreboard: config?.scoreboard.url ? hostOf(config.scoreboard.url) : null,
      shotclock: config?.shotclock.url ? hostOf(config.shotclock.url) : null,
    },
    vmix: (config?.vmix.instances ?? []).map((i) => {
      const state = parts.vmix.state(i.id ?? '');
      return {id: i.id ?? '', name: i.name, host: hostOf(i.url), state: state ? (state.ok ? 'ok' : 'unreachable') : 'unknown', ageMs: state ? Math.max(0, now - Date.parse(state.at)) : null};
    }),
    stats: {database: config ? (config.stats.mdbEnabled ? 'enabled' : 'disabled') : null, page: config?.stats.pageUrl ? 'configured' : 'not set'},
    fallback: {
      paths: ['/api/scoreboard', '/api/scoreboard/clock', '/api/scoreboard/shotclock', '/api/stats/*', 'POST /api/vmix/set-timer'],
      key: '********',
    },
  };
}
