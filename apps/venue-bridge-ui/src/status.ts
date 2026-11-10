/** The answer of the bridge's own `/bridge/status` (apps/venue-bridge/src/services/bridgeStatus.ts); no secrets in it. */
export type DeviceState = 'ok' | 'unreachable' | 'invalid' | 'not-configured' | 'unknown';

/** What the bridge knows about reading WEDSTRIJDEN.mdb (apps/venue-bridge/src/services/mdbFile.ts). */
export type DatabaseStatus = {
  shareReadAt: string | null;
  shareCheckedAt: string | null;
  lastError: {message: string; at: string} | null;
  failures: number;
  skipUntil: string | null;
  hostReachable: boolean | null;
  fileModifiedAt: string | null;
  fileBytes: number | null;
  copyWrittenAt: string | null;
  copyError: {message: string; at: string} | null;
  parseMs: number | null;
  lastAnswer: {source: 'share' | 'copy'; readAt: string; team: string | null; at: string} | null;
};

export type BridgeStatus = {
  name: string;
  version: string;
  api: {connected: boolean; since: string | null; error: string | null};
  config: {state: 'none' | 'applied'; source: string | null; version: string | null; receivedAt: string | null};
  devices: Record<'score' | 'clock' | 'shotclock', {state: DeviceState; ageMs: number | null}>;
  hosts: {scoreboard: string | null; shotclock: string | null};
  vmix: {id: string; name: string; host: string; state: 'ok' | 'unreachable' | 'unknown'; ageMs: number | null}[];
  stats: {
    database: 'enabled' | 'disabled' | null;
    page: 'configured' | 'not set';
    shareHost: string | null;
    folder: 'set' | 'not set';
    keepCopy: boolean | null;
    /** Only when the database is switched on */
    share?: DatabaseStatus;
  };
  fallback: {paths: string[]; key: string};
};

export const REFRESH_MS = 2000;

export async function fetchBridgeStatus(): Promise<BridgeStatus> {
  const res = await fetch('/bridge/status', {cache: 'no-store'});
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}
