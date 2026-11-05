import axios from 'axios';
import {config} from '../config';
import {logger} from '../logger';
import {HTML_EXTENSIONS, MAX_HTML_BYTES, readSharedFile} from './mdbFile';
import {isHttpUrl} from './smbReach';
import {shareHostOf} from './smbReach';
import {NOT_CONFIGURED_PAGE, StatsError} from './statsErrors';
import {decodeStatsPage, parseTweedeScherm, type TweedeScherm} from './tweedeScherm';

const REQUEST_DEADLINE_MS = 4000;
export const MAX_PAGE_BYTES = 512 * 1024;
export const LIVE_CACHE_MS = 3000;

type Entry = {url: string; at: number; value?: TweedeScherm; pending?: Promise<TweedeScherm>};
let entry: Entry | null = null;

export function clearLiveStatsCache(): void {
  entry = null;
}

export {isHttpUrl};

export async function fetchPage(url: string, host: string | null = null): Promise<TweedeScherm> {
  if (!isHttpUrl(url)) {
    // A relative .html file inside STATS_DIR (development, testing): same safe resolution, size limit and decoding
    const buffer = await readSharedFile(url, HTML_EXTENSIONS, MAX_HTML_BYTES, host);
    try {
      return parseTweedeScherm(decodeStatsPage(new Uint8Array(buffer)));
    } catch {
      throw new StatsError(502, 'Het statistiekenbestand is geen statistiekenpagina');
    }
  }
  try {
    // Wall-clock deadline (axios' timeout is an idle timeout, a dripping server would hold on)
    const res = await axios.get<ArrayBuffer>(url, {
      signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
      maxContentLength: MAX_PAGE_BYTES,
      responseType: 'arraybuffer',
      // A redirect is an unreachable page (no following to another host)
      maxRedirects: 0,
    });
    return parseTweedeScherm(decodeStatsPage(new Uint8Array(res.data)));
  } catch (err) {
    logger.warn('Statistics page fetch failed', {error: err instanceof Error ? err.message : String(err)});
    throw new StatsError(502, 'De statistiekenpagina is niet bereikbaar of gaf een onbekend antwoord');
  }
}

/**
 * The parsed page of the statistics PC. Many polls hit the PC at most once per LIVE_CACHE_MS: a fresh
 * answer is reused and a running request is shared.
 */
export async function getLiveStats(): Promise<TweedeScherm> {
  const pageUrl = config.pageUrl;
  if (!pageUrl) throw NOT_CONFIGURED_PAGE;
  if (entry && entry.url === pageUrl) {
    if (entry.pending) return entry.pending;
    if (entry.value && Date.now() - entry.at < LIVE_CACHE_MS) return entry.value;
  }
  const next: Entry = {url: pageUrl, at: 0};
  next.pending = fetchPage(pageUrl, shareHostOf(config)).then(
    (value) => {
      next.value = value;
      next.at = Date.now();
      next.pending = undefined;
      return value;
    },
    (err) => {
      if (entry === next) entry = null;
      throw err;
    },
  );
  entry = next;
  return next.pending;
}
