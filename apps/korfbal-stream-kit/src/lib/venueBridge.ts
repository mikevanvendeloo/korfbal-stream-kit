import {createUrl, extractError} from './api';

export type VenueDeviceState = 'ok' | 'unreachable' | 'invalid' | 'not-configured' | 'no-data';
export type VenueDeviceName = 'score' | 'clock' | 'shotclock';

/** The body of `GET /api/venue-bridge/status` and of the `venue_bridge_status` socket event. */
export type VenueBridgeStatus = {
  connected: boolean;
  name: string | null;
  version: string | null;
  pageUrl: string | null;
  connectedAt: string | null;
  config: {state: 'applied' | 'refused' | 'pending'; error: string | null};
  devices: Record<VenueDeviceName, {state: VenueDeviceState; ageMs: number | null}>;
};

export const VENUE_BRIDGE_STATUS_EVENT = 'venue_bridge_status';

export async function fetchVenueBridgeStatus(): Promise<VenueBridgeStatus> {
  const res = await fetch(createUrl('/api/venue-bridge/status'));
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}
