import type {IncomingHttpHeaders} from 'http';
import type {NextFunction, Request, Response} from 'express';
import {isFeedApiPath, requestApiKey} from './apiKey';

type HostAndPort = {hostname: string; port: string | null};

/** `host[:port]` as in a Host or X-Forwarded-Host header; the port only when it is written out. */
function parseHostHeader(value: string): HostAndPort | null {
  const match = /^(\[[^\]]+\]|[^:[\]]+)(?::(\d{1,5}))?$/.exec(value.trim());
  if (!match) return null;
  try {
    return {hostname: new URL(`http://${match[1]}`).hostname.toLowerCase(), port: match[2] ?? null};
  } catch {
    return null;
  }
}

/** The origin's host and port; the port is always known (80/443 when the URL leaves it out). */
function parseOrigin(origin: string): HostAndPort | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return {hostname: url.hostname.toLowerCase(), port: url.port || (url.protocol === 'https:' ? '443' : '80')};
  } catch {
    return null;
  }
}

const firstValue = (header: string | string[] | undefined) =>
  (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim() || undefined;

/**
 * Whether a browser request comes from a page on this server. The frontend is always same-origin: the
 * Vite dev proxy sends X-Forwarded-Host (its own host and port, `xfwd`), nginx sends `Host: $host`.
 * The host the browser used is X-Forwarded-Host when present, else Host. Hostnames must match; the port
 * too when that header carries one. nginx's `$host` has no port, so behind nginx only the hostname is
 * compared. Requests without an Origin (vMix, curl, Node) aren't from a browser page and pass.
 * A browser page can't set X-Forwarded-Host or Host on a cross-site request, so trusting them is safe.
 */
export function isSameOriginRequest(req: {headers: IncomingHttpHeaders}): boolean {
  const origin = firstValue(req.headers.origin);
  if (!origin) return true;
  const from = parseOrigin(origin);
  const hostHeader = firstValue(req.headers['x-forwarded-host']) ?? firstValue(req.headers.host);
  const to = hostHeader ? parseHostHeader(hostHeader) : null;
  if (!from || !to) return false;
  return from.hostname === to.hostname && (to.port === null || to.port === from.port);
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard on /api: a state-changing request (not GET/HEAD/OPTIONS) from a page on another site is
 * refused with 403. Cross-site means `Sec-Fetch-Site: cross-site`, or an Origin that isn't this server
 * (`isSameOriginRequest`). Without an Origin (vMix, curl, Node) a request passes, and so does a feed
 * request with an API key (e.g. an HTML overlay calling trigger-manual): the key decides the
 * organization there, and an invalid key gets 401 in `organizationContext`.
 */
export function refuseCrossSiteWrites(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isFeedApiPath(req.path) && typeof requestApiKey(req) === 'string') return next();
  const crossSite = firstValue(req.headers['sec-fetch-site']) === 'cross-site' || !isSameOriginRequest(req);
  if (crossSite) return res.status(403).json({error: 'Verzoek van een andere website geweigerd'});
  return next();
}
