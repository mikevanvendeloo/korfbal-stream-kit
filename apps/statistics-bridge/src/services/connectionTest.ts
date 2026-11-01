import {config} from '../config';
import {getLiveStats} from './liveStats';
import {sharedFileStamp, usesTeam, withTeam, type TeamChoice} from './mdbFile';
import {shareHostOf, smbReachable} from './smbReach';

export {shareHostOf, smbReachable} from './smbReach';

export type Check = {ok: boolean; ms: number | null} | null;
/** database: 'disabled' (MDB_ENABLED=false), or the file check on the share: ok/failed (null: not tried) */
export type StatsConnection = {team: TeamChoice | null; host: string | null; network: Check; database: 'disabled' | Check; page: Check};

async function timed(work: () => Promise<unknown>): Promise<{ok: boolean; ms: number | null}> {
  const started = Date.now();
  return work().then(() => ({ok: true, ms: Date.now() - started}), () => ({ok: false, ms: null}));
}

async function checkConnection(team: string): Promise<StatsConnection> {
  const host = shareHostOf(config);
  // Switched off: no network probe for the share and nothing of the database is touched
  if (!config.mdbEnabled) {
    return {team: null, host, network: null, database: 'disabled', page: config.pageUrl ? await timed(() => getLiveStats()) : null};
  }
  const teamChoice = config.mdbPath && usesTeam(config.mdbPath) ? {value: team} : null;
  const mdbPath = config.mdbPath && teamChoice ? withTeam(config.mdbPath, team) : config.mdbPath;
  const network = host ? await smbReachable(host) : null;
  // With a known host the file is only tried when the PC answered; without a host the share's own guards apply
  const fileAllowed = host ? network?.ok === true : true;
  // One after the other: the share takes one operation at a time (a local .html page uses it too)
  const database = mdbPath && config.statsDir && fileAllowed ? await timed(() => sharedFileStamp(mdbPath, host)) : null;
  const page = config.pageUrl ? await timed(() => getLiveStats()) : null;
  return {team: teamChoice, host, network, database, page};
}

const STATUS_CACHE_MS = 3000;
type StatusEntry = {team: string; at: number; value?: StatsConnection; pending?: Promise<StatsConnection>};
let statusEntry: StatusEntry | null = null;

export function clearStatusCache(): void {
  statusEntry = null;
}

/** The connection test: a fresh answer is reused for 3 s and a running check is shared. */
export async function statsConnection(team: string): Promise<StatsConnection> {
  const hit = statusEntry;
  if (hit && hit.team === team) {
    if (hit.pending) return hit.pending;
    if (hit.value && Date.now() - hit.at < STATUS_CACHE_MS) return hit.value;
  }
  const entry: StatusEntry = {team, at: 0};
  entry.pending = checkConnection(team).then(
    (value) => {
      entry.value = value;
      entry.at = Date.now();
      entry.pending = undefined;
      return value;
    },
    (err) => {
      if (statusEntry === entry) statusEntry = null;
      throw err;
    },
  );
  statusEntry = entry;
  return entry.pending;
}
