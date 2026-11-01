export {shareHostOf, smbReachable} from './smbReach';
import {config} from '../config';
import {getMatchStats} from '../appSettings';
import {getLiveStats} from './liveStats';
import {requireOrganizationId} from '../organizationContext';
import {shareHostOf, smbReachable} from './smbReach';
import {sharedFileStamp} from './mdbFile';

export type Check = {ok: boolean; ms: number | null} | null;
export type StatsConnection = {host: string | null; network: Check; file: Check; page: Check};

async function timed(work: () => Promise<unknown>): Promise<{ok: boolean; ms: number | null}> {
  const started = Date.now();
  return work().then(() => ({ok: true, ms: Date.now() - started}), () => ({ok: false, ms: null}));
}

/**
 * Can we reach the statistics PC: the network (SMB port), the database file on the mounted share and the page.
 * Only ok/failed and a time, never an error text. The file is only tried when the PC is on the network, so a
 * missing PC never makes a read of the mount hang.
 */
async function checkConnection(): Promise<StatsConnection> {
  const setting = await getMatchStats();
  const host = shareHostOf(setting);
  const network = host ? await smbReachable(host) : null;
  // With a known host the file is only tried when the PC answered; without a host the share's own guards apply
  const fileAllowed = host ? network?.ok === true : true;
  const [file, page] = await Promise.all([
    setting.mdbPath && config.statsDir && fileAllowed ? timed(() => sharedFileStamp(setting.mdbPath as string, host)) : null,
    setting.pageUrl ? timed(() => getLiveStats()) : null,
  ]);
  return {host, network, file, page};
}

const STATUS_CACHE_MS = 3000;
type StatusEntry = {at: number; value?: StatsConnection; pending?: Promise<StatsConnection>};
const statusEntries = new Map<number, StatusEntry>();

export function clearStatusCache(): void {
  statusEntries.clear();
}

/** The connection test per organization: a fresh answer is reused for 3 s and a running check is shared. */
export async function statsConnection(): Promise<StatsConnection> {
  const orgId = requireOrganizationId('statistics status');
  const hit = statusEntries.get(orgId);
  if (hit?.pending) return hit.pending;
  if (hit?.value && Date.now() - hit.at < STATUS_CACHE_MS) return hit.value;
  const entry: StatusEntry = {at: 0};
  entry.pending = checkConnection().then(
    (value) => {
      entry.value = value;
      entry.at = Date.now();
      entry.pending = undefined;
      return value;
    },
    (err) => {
      statusEntries.delete(orgId);
      throw err;
    },
  );
  statusEntries.set(orgId, entry);
  return entry.pending;
}
