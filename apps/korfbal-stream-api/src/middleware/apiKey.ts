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
  /^\/vmix\/production\/active\/titles\/[^/]+$/,
  /^\/vmix\/production\/[^/]+\/titles$/,
  '/vmix/callsheet/timing',
  '/vmix/sync/activate-event',
  '/vmix/production/trigger-manual',
  '/vmix/set-timer',
  // Stream Deck buttons (Bitfocus Companion): the Show Caller's next/previous and remaining time
  '/show/next',
  '/show/previous',
  '/show/remaining',
  /^\/scoreboard(\/.*)?$/,
];

export function isFeedApiPath(path: string): boolean {
  // Express matches routes case-insensitively and with an optional trailing slash: so does this
  const normalized = path.toLowerCase().replace(/(.)\/$/, '$1');
  return FEED_API_PATHS.some((p) => (typeof p === 'string' ? p === normalized : p.test(normalized)));
}

/**
 * Query parameter names (decoded) that qs — Express's query parser — puts under `req.query.key`:
 * `key`, `key[]`, `key[x]`, and the bracketed root `[key]`, `[key][x]`. All of them are stripped.
 */
const KEY_PARAM_NAME = /^(?:key|\[key\])(?:\[.*)?$/;
const isKeyParam = (name: string) => KEY_PARAM_NAME.test(name);

function splitUrl(url: string): {path: string; params: URLSearchParams | null} {
  const q = url.indexOf('?');
  return q < 0 ? {path: url, params: null} : {path: url.slice(0, q), params: new URLSearchParams(url.slice(q + 1))};
}

/** The URL without its API key, for routing and for every log line after this point. */
export function withoutApiKey(url: string): string {
  const {path, params} = splitUrl(url);
  if (!params) return url;
  const names = [...new Set([...params.keys()].filter(isKeyParam))];
  if (names.length === 0) return url;
  for (const name of names) params.delete(name);
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

/**
 * The key in the URL, read with one parser (URLSearchParams): undefined without one, the key when
 * there is exactly one plain `key=` and nothing else with the key root, otherwise null (invalid).
 */
function queryApiKey(url: string): string | null | undefined {
  const {params} = splitUrl(url);
  if (!params) return undefined;
  const names = [...params.keys()].filter(isKeyParam);
  if (names.length === 0) return undefined;
  const values = params.getAll(API_KEY_QUERY_PARAM);
  return names.length === 1 && values.length === 1 ? values[0] : null;
}

const apiKeys = new WeakMap<Request, string | null>();

/**
 * Runs first: takes the API key off the request (header and query) and keeps it aside, so nothing
 * later — the request log, the error handler, a route — can see or log it. The query key is read from
 * the URL only (`queryApiKey`); `req.query` is only stripped. A key that isn't a single string is kept
 * as an invalid one (null).
 */
export function extractApiKey(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers[API_KEY_HEADER.toLowerCase()];
  const fromUrl = queryApiKey(req.url);
  // qs found a key the URL scan didn't (a parser difference): invalid, and we can't tell which
  // parameter holds it, so the whole query string goes
  const onlyInQuery = fromUrl === undefined && req.query?.[API_KEY_QUERY_PARAM] !== undefined;
  if (header === undefined && fromUrl === undefined && !onlyInQuery) return next();

  const candidate = header !== undefined ? header : onlyInQuery ? null : fromUrl;
  apiKeys.set(req, typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null);

  delete req.headers[API_KEY_HEADER.toLowerCase()];
  if (req.query) delete (req.query as Record<string, unknown>)[API_KEY_QUERY_PARAM];
  const strip = (url: string) => (onlyInQuery ? splitUrl(url).path : withoutApiKey(url));
  req.url = strip(req.url);
  req.originalUrl = strip(req.originalUrl);
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
