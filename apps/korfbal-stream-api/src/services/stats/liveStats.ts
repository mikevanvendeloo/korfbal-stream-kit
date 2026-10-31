import axios from 'axios';
import {getMatchStats} from '../appSettings';
import {requireOrganizationId} from '../organizationContext';
import {logger} from '../../utils/logger';
import {NOT_CONFIGURED_PAGE, StatsError} from './statsErrors';
import {decodeStatsPage, parseTweedeScherm, type TweedeScherm} from './tweedeScherm';

const REQUEST_DEADLINE_MS = 4000;
const MAX_PAGE_BYTES = 2_000_000;
export const LIVE_CACHE_MS = 3000;

type Entry = {url: string; at: number; value?: TweedeScherm; pending?: Promise<TweedeScherm>};
const entries = new Map<number, Entry>();

export function clearLiveStatsCache(): void {
  entries.clear();
}

async function fetchPage(url: string): Promise<TweedeScherm> {
  try {
    // Wall-clock deadline (axios' timeout is an idle timeout, a dripping server would hold on)
    const res = await axios.get<ArrayBuffer>(url, {
      signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
      maxContentLength: MAX_PAGE_BYTES,
      responseType: 'arraybuffer',
    });
    return parseTweedeScherm(decodeStatsPage(new Uint8Array(res.data)));
  } catch (err) {
    logger.warn('Statistics page fetch failed', {error: err instanceof Error ? err.message : String(err)});
    throw new StatsError(502, 'De statistiekenpagina is niet bereikbaar of gaf een onbekend antwoord');
  }
}

/**
 * The parsed page of the organization's statistics PC. Many vMix polls hit the PC at most once per
 * LIVE_CACHE_MS: a fresh answer is reused and a running request is shared.
 */
export async function getLiveStats(): Promise<TweedeScherm> {
  const {pageUrl} = await getMatchStats();
  if (!pageUrl) throw NOT_CONFIGURED_PAGE;
  const orgId = requireOrganizationId('live statistics');
  const entry = entries.get(orgId);
  if (entry && entry.url === pageUrl) {
    if (entry.pending) return entry.pending;
    if (entry.value && Date.now() - entry.at < LIVE_CACHE_MS) return entry.value;
  }
  const next: Entry = {url: pageUrl, at: 0};
  next.pending = fetchPage(pageUrl).then(
    (value) => {
      next.value = value;
      next.at = Date.now();
      next.pending = undefined;
      return value;
    },
    (err) => {
      entries.delete(orgId);
      throw err;
    },
  );
  entries.set(orgId, next);
  return next.pending;
}
