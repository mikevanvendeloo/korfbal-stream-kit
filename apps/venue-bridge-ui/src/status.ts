/** The answer of the bridge's own `/bridge/status` (apps/venue-bridge/src/services/bridgeStatus.ts); no secrets in it. */
export type DeviceState = 'ok' | 'unreachable' | 'invalid' | 'not-configured' | 'unknown';

export type BridgeStatus = {
  name: string;
  version: string;
  api: {connected: boolean; since: string | null; error: string | null};
  config: {state: 'none' | 'applied'; source: string | null; version: string | null; receivedAt: string | null};
  devices: Record<'score' | 'clock' | 'shotclock', {state: DeviceState; ageMs: number | null}>;
  hosts: {scoreboard: string | null; shotclock: string | null};
  vmix: {id: string; name: string; host: string; state: 'ok' | 'unreachable' | 'unknown'; ageMs: number | null}[];
  stats: {database: 'enabled' | 'disabled' | null; page: 'configured' | 'not set'};
  fallback: {paths: string[]; key: string};
};

export const REFRESH_MS = 2000;

export async function fetchBridgeStatus(): Promise<BridgeStatus> {
  const res = await fetch('/bridge/status', {cache: 'no-store'});
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}
