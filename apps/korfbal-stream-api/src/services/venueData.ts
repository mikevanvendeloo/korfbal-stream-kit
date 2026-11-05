import {parseVenueTime, type VenueDevice, type VenueReading, VENUE_DEVICES} from '@korfbal-stream-kit/venue-protocol';
import {logger} from '../utils/logger';
import {runWithOrganization} from './organizationContext';
import {getBridge} from './venueBridge';
import {liveOrganizationIds, updateVenueClock} from './productionState';
import {emitToOrganizationId} from './socket';

/** A device reading counts for this long after it arrived (the bridge sends again at least every 5 s). */
export const READING_CURRENT_MS = 10_000;
export const VENUE_BRIDGE_STATUS_EVENT = 'venue_bridge_status';

export type DeviceState = 'ok' | 'unreachable' | 'invalid' | 'not-configured' | 'no-data';
export type ConfigState = {state: 'applied' | 'refused' | 'pending'; error: string | null};
export type VenueBridgeStatus = {
  connected: boolean;
  name: string | null;
  version: string | null;
  pageUrl: string | null;
  connectedAt: string | null;
  config: ConfigState;
  devices: Record<VenueDevice, {state: DeviceState; ageMs: number | null}>;
};

type Stored = {reading: VenueReading; receivedAt: number};
type OrganizationData = {devices: Map<VenueDevice, Stored>; config: ConfigState};

const data = new Map<number, OrganizationData>();
const lastEmitted = new Map<number, string>();

function dataOf(organizationId: number): OrganizationData {
  let entry = data.get(organizationId);
  if (!entry) {
    entry = {devices: new Map(), config: {state: 'pending', error: null}};
    data.set(organizationId, entry);
  }
  return entry;
}

/** The latest reading of a device when it is ok, recent and its bridge is still connected. */
export function currentReading(organizationId: number, device: VenueDevice, now = Date.now()): VenueReading | null {
  if (!getBridge(organizationId)) return null;
  const stored = data.get(organizationId)?.devices.get(device);
  return stored && stored.reading.ok && now - stored.receivedAt < READING_CURRENT_MS ? stored.reading : null;
}

/** The latest reading whether or not it is current (to tell "invalid" from "unreachable"). */
export function latestReading(organizationId: number, device: VenueDevice): VenueReading | null {
  return data.get(organizationId)?.devices.get(device)?.reading ?? null;
}

export function venueBridgeStatus(organizationId: number, now = Date.now()): VenueBridgeStatus {
  const bridge = getBridge(organizationId);
  const entry = data.get(organizationId);
  const devices = {} as VenueBridgeStatus['devices'];
  for (const device of VENUE_DEVICES) {
    const stored = bridge ? entry?.devices.get(device) : undefined;
    const age = stored ? now - stored.receivedAt : null;
    devices[device] = !stored || age === null || age >= READING_CURRENT_MS
      ? {state: 'no-data', ageMs: age}
      : {state: stored.reading.ok ? 'ok' : stored.reading.error ?? 'unreachable', ageMs: age};
  }
  return {
    connected: !!bridge,
    name: bridge?.name ?? null,
    version: bridge?.version ?? null,
    pageUrl: bridge?.pageUrl ?? null,
    connectedAt: bridge?.connectedAt.toISOString() ?? null,
    config: bridge ? dataOf(organizationId).config : {state: 'pending', error: null},
    devices,
  };
}

/** What a change in the status is judged on: connection, configuration and device states, not ages. */
function statusKey(status: VenueBridgeStatus): string {
  return JSON.stringify([status.connected, status.name, status.version, status.config, VENUE_DEVICES.map((d) => status.devices[d].state)]);
}

/** Tells the organization's clients when the status changed since the last time. */
export function emitStatusIfChanged(organizationId: number): void {
  const status = venueBridgeStatus(organizationId);
  const key = statusKey(status);
  if (lastEmitted.get(organizationId) === key) return;
  lastEmitted.set(organizationId, key);
  emitToOrganizationId(organizationId, VENUE_BRIDGE_STATUS_EVENT, status);
}

/** A bridge connected: its old readings are gone, its configuration is not applied yet. */
export function bridgeConnected(organizationId: number): void {
  data.set(organizationId, {devices: new Map(), config: {state: 'pending', error: null}});
  emitStatusIfChanged(organizationId);
}

export function bridgeDisconnected(organizationId: number): void {
  data.delete(organizationId);
  emitStatusIfChanged(organizationId);
}

export function setConfigState(organizationId: number, config: ConfigState): void {
  dataOf(organizationId).config = config;
  emitStatusIfChanged(organizationId);
}

/** Keeps a validated reading; a current clock reading also feeds the running show's venue clock. */
export function recordReading(organizationId: number, reading: VenueReading): void {
  dataOf(organizationId).devices.set(reading.device, {reading, receivedAt: Date.now()});
  if (reading.device === 'clock' && reading.ok) {
    const time = parseVenueTime(reading.data);
    if (time && liveOrganizationIds().includes(organizationId)) {
      try {
        runWithOrganization(organizationId, () => updateVenueClock(time));
      } catch (err) {
        logger.debug('Venue clock update failed', {error: (err as Error)?.message});
      }
    }
  }
  emitStatusIfChanged(organizationId);
}

/** Forgets everything (tests). */
export function clearVenueData(): void {
  data.clear();
  lastEmitted.clear();
}
