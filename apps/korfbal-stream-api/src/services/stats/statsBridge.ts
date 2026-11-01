import axios from 'axios';
import {getBridgeToken, getMatchStats} from '../appSettings';
import {requireOrganizationId} from '../organizationContext';
import {logger} from '../../utils/logger';
import {resolveStatsTeam, type StatsTeam} from './statsTeam';

/**
 * The statistics bridge: its own app that reads the statistics PC (share and page). The API only asks it
 * and passes the answer on, so a failing PC or share takes down the bridge, not the API.
 */
const REQUEST_DEADLINE_MS = 5000;
const MAX_ANSWER_BYTES = 10 * 1024 * 1024;
const CACHE_MS = 2000;
/** After a failed request the bridge counts as offline for this long, so polls don't each wait for the deadline. */
const OFFLINE_MEMORY_MS = 2000;
const FORWARDED_HEADERS = ['x-stats-source', 'x-stats-read-at', 'x-stats-database', 'x-stats-team'] as const;

export class BridgeOfflineError extends Error {
  constructor() {
    super('Statistics bridge offline');
  }
}

/** The bridge is not set up for this organization. */
export class BridgeNotConfiguredError extends Error {
  constructor() {
    super('De statistics bridge is niet ingesteld: vul het adres in bij Instellingen → Statistieken');
  }
}

export type BridgeAnswer = {status: number; headers: Record<string, string>; body: unknown; ms: number};

type Entry = {at: number; value?: BridgeAnswer; pending?: Promise<BridgeAnswer>};
const entries = new Map<string, Entry>();
const offlineUntil = new Map<number, number>();

export function clearStatsBridgeCache(): void {
  entries.clear();
  offlineUntil.clear();
}

async function request(base: string, token: string | null, pathAndQuery: string): Promise<BridgeAnswer> {
  const started = Date.now();
  let res;
  try {
    res = await axios.get<string>(`${base}${pathAndQuery}`, {
      // Wall-clock deadline (axios' timeout is an idle timeout, a dripping server would hold on)
      signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
      maxContentLength: MAX_ANSWER_BYTES,
      maxRedirects: 0,
      responseType: 'text',
      transformResponse: (d) => d,
      validateStatus: () => true,
      headers: token ? {'X-Bridge-Token': token} : undefined,
    });
  } catch (err) {
    logger.warn('Statistics bridge not reachable', {error: err instanceof Error ? err.message : String(err)});
    throw new BridgeOfflineError();
  }
  // Only an answer from the bridge itself counts: JSON with an object. Redirects and proxy pages mean offline.
  let body: unknown;
  try {
    body = JSON.parse(res.data);
  } catch {
    throw new BridgeOfflineError();
  }
  if (res.status >= 300 && res.status < 400) throw new BridgeOfflineError();
  if (res.status >= 400 && !(body && typeof body === 'object' && typeof (body as {error?: unknown}).error === 'string')) throw new BridgeOfflineError();
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const v = res.headers[name];
    if (typeof v === 'string') headers[name] = v;
  }
  return {status: res.status, headers, body, ms: Date.now() - started};
}

/** One GET to the bridge for the organization in the context; a fresh 200 is reused briefly and a running request shared. */
export async function bridgeGet(pathAndQuery: string): Promise<BridgeAnswer> {
  const {bridgeUrl} = await getMatchStats();
  if (!bridgeUrl) throw new BridgeNotConfiguredError();
  const orgId = requireOrganizationId('statistics bridge');
  if ((offlineUntil.get(orgId) ?? 0) > Date.now()) throw new BridgeOfflineError();
  const key = `${orgId}|${bridgeUrl}|${pathAndQuery}`;
  const hit = entries.get(key);
  if (hit?.pending) return hit.pending;
  if (hit?.value && Date.now() - hit.at < CACHE_MS) return hit.value;
  const entry: Entry = {at: 0};
  entry.pending = getBridgeToken().then((token) => request(bridgeUrl, token, pathAndQuery)).then(
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
