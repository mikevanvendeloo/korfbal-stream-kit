import {StatsAnswerSchema, VENUE_EVENTS} from '@korfbal-stream-kit/venue-protocol';
import {requireOrganizationId} from '../organizationContext';
import {askBridge, BridgeOfflineError} from '../venueBridge';
import {resolveStatsTeam, type StatsTeam} from './statsTeam';

/**
 * The statistics come from the venue-bridge (it sits at the venue and reads the statistics PC: share and page). The API
 * only asks it over the bridge's socket and passes the answer on, so a failing PC or share takes down the bridge, not the API.
 */
const REQUEST_DEADLINE_MS = 5000;
const MAX_ANSWER_BYTES = 10 * 1024 * 1024;
const CACHE_MS = 2000;
/** After a failed request the bridge counts as offline for this long, so polls don't each wait for the deadline. */
const OFFLINE_MEMORY_MS = 2000;
const FORWARDED_HEADERS = ['x-stats-source', 'x-stats-read-at', 'x-stats-database', 'x-stats-team'] as const;

export {BridgeOfflineError};

export type BridgeAnswer = {status: number; headers: Record<string, string>; body: unknown; ms: number};

type Entry = {at: number; value?: BridgeAnswer; pending?: Promise<BridgeAnswer>};
const entries = new Map<string, Entry>();
const offlineUntil = new Map<number, number>();

export function clearStatsBridgeCache(): void {
  entries.clear();
  offlineUntil.clear();
}

async function request(pathAndQuery: string): Promise<BridgeAnswer> {
  const started = Date.now();
  const answer = await askBridge(VENUE_EVENTS.statsRequest, {path: pathAndQuery}, {deadlineMs: REQUEST_DEADLINE_MS, maxBytes: MAX_ANSWER_BYTES, schema: StatsAnswerSchema});
  // The bridge's own refusals are JSON with an `error`; anything else with an error status is not a bridge answer
  if (answer.status >= 400 && !(answer.body && typeof answer.body === 'object' && typeof (answer.body as {error?: unknown}).error === 'string')) throw new BridgeOfflineError();
  if (answer.status >= 300 && answer.status < 400) throw new BridgeOfflineError();
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const v = answer.headers[name];
    if (typeof v === 'string') headers[name] = v;
  }
  return {status: answer.status, headers, body: answer.body, ms: Date.now() - started};
}

/** One GET to the bridge for the organization in the context; a fresh 200 is reused briefly and a running request shared. */
export async function bridgeGet(pathAndQuery: string): Promise<BridgeAnswer> {
  const orgId = requireOrganizationId('statistics bridge');
  if ((offlineUntil.get(orgId) ?? 0) > Date.now()) throw new BridgeOfflineError();
  const key = `${orgId}|${pathAndQuery}`;
  const hit = entries.get(key);
  if (hit?.pending) return hit.pending;
  if (hit?.value && Date.now() - hit.at < CACHE_MS) return hit.value;
  const entry: Entry = {at: 0};
  entry.pending = request(pathAndQuery).then(
    (value) => {
      entry.pending = undefined;
      if (value.status === 200) {
        entry.value = value;
        entry.at = Date.now();
      } else entries.delete(key);
      return value;
    },
    (err) => {
      entries.delete(key);
      if (err instanceof BridgeOfflineError) offlineUntil.set(orgId, Date.now() + OFFLINE_MEMORY_MS);
      throw err;
    },
  );
  entries.set(key, entry);
  return entry.pending;
}

/** The team part of an answer: the bridge says only the number, the API knows where it came from. */
export function withTeamSource(answer: BridgeAnswer, team: StatsTeam): {headers: Record<string, string>; body: unknown} {
  const headers = {...answer.headers};
  if (headers['x-stats-team'] !== undefined) headers['x-stats-team'] = `${team.value}; from=${team.from}`;
  let body = answer.body;
  if (body && typeof body === 'object' && !Array.isArray(body) && (body as {team?: unknown}).team) body = {...(body as object), team};
  return {headers, body};
}

/** The team number the bridge is asked for: the active production's, 1 by default. */
export const statsTeam = resolveStatsTeam;
