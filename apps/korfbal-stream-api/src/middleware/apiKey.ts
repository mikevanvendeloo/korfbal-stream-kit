import type {NextFunction, Request, Response} from 'express';

export const API_KEY_HEADER = 'X-Api-Key';
export const API_KEY_QUERY_PARAM = 'key';

/**
 * Feed routes (D7), relative to the /api mount: what vMix data sources, vMix triggers and scoreboard
 * displays call. They accept an API key (`?key=` or X-Api-Key) instead of X-Organization; the browser
 * (LIVE scoreboard and vMix pages) keeps sending X-Organization. A key opens nothing else.
 */
const FEED_API_PATHS: ReadonlyArray<string | RegExp> = [
  '/vmix/sponsor-names',
  '/vmix/sponsor-carrousel',
  '/vmix/sponsor-slides',
  '/vmix/active-production/match',
  '/vmix/active-production/staff',
  '/vmix/production/active/titles',
  /^\/vmix\/production\/[^/]+\/titles$/,
  '/vmix/callsheet/timing',
  '/vmix/sync/activate-event',
  '/vmix/production/trigger-manual',
  /^\/scoreboard(\/.*)?$/,
];

export function isFeedApiPath(path: string): boolean {
  // Express matches routes case-insensitively and with an optional trailing slash: so does this
  const normalized = path.toLowerCase().replace(/(.)\/$/, '$1');
  return FEED_API_PATHS.some((p) => (typeof p === 'string' ? p === normalized : p.test(normalized)));
}

/** Query parameter names that carry the key (`key`, and qs's `key[]`/`key[x]` forms). */
const isKeyParam = (name: string) => name === API_KEY_QUERY_PARAM || name.startsWith(`${API_KEY_QUERY_PARAM}[`);

/** The URL without its API key, for routing and for every log line after this point. */
export function withoutApiKey(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  const names = [...new Set([...params.keys()].filter(isKeyParam))];
  if (names.length === 0) return url;
  for (const name of names) params.delete(name);
  const rest = params.toString();
  return rest ? `${url.slice(0, q)}?${rest}` : url.slice(0, q);
}

const apiKeys = new WeakMap<Request, string | null>();

/**
 * Runs first: takes the API key off the request (header and query) and keeps it aside, so nothing
 * later — the request log, the error handler, a route — can see or log it. A key that isn't a single
 * string is kept as an invalid one (null).
 */
export function extractApiKey(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers[API_KEY_HEADER.toLowerCase()];
  const fromQuery = req.query?.[API_KEY_QUERY_PARAM];
  const hasQueryKey = req.url.includes('?') && withoutApiKey(req.url) !== req.url;
  if (header === undefined && fromQuery === undefined && !hasQueryKey) return next();

  const candidate = header !== undefined ? header : fromQuery;
  apiKeys.set(req, typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null);

  delete req.headers[API_KEY_HEADER.toLowerCase()];
  if (req.query) delete (req.query as Record<string, unknown>)[API_KEY_QUERY_PARAM];
  req.url = withoutApiKey(req.url);
  req.originalUrl = withoutApiKey(req.originalUrl);
  return next();
}

/** The API key this request came with: undefined without one, null for a malformed one. */
export function requestApiKey(req: Request): string | null | undefined {
  return apiKeys.get(req);
}

/**
 * CORS only where another origin has a reason to read: the feeds (with a key, e.g. an HTML overlay)
 * and the static logos/photos. The rest of the API is same-origin only (Vite proxy, nginx).
 */
export function feedCors(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  const isStatic = /^\/(uploads|storage|assets)(\/|$)/i.test(path);
  const isFeed = /^\/api\//i.test(path) && isFeedApiPath(path.slice(4));
  if (!isStatic && !isFeed) return next();
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', `Content-Type, ${API_KEY_HEADER}`);
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}
