/**
 * The chosen organization (design D2/D3). Every same-origin `/api` request carries it as the
 * `X-Organization` header, added centrally by `installOrganizationFetch()` so the many `fetch` calls in
 * the kit don't each have to. The Socket.io handshake sends it as `auth.organization` (`socketAuth`).
 *
 * The choice is kept in `localStorage` (`organization` = slug) and in memory, so it also works when
 * storage is blocked (private window): then it lasts until the page is reloaded.
 */
import {API_ERROR_CODES} from './apiErrorCodes';

export const ORGANIZATION_STORAGE_KEY = 'organization';
export const ORGANIZATION_HEADER = 'X-Organization';

/**
 * Lowercase letters, digits and single dashes (the API refuses anything else).
 * Keep in sync with ORGANIZATION_SLUG_PATTERN in apps/korfbal-stream-api/src/middleware/organizationContext.ts.
 */
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Codes that mean "choose (another) organization": only these open the start screen. */
const ORGANIZATION_REJECTED_CODES: ReadonlySet<string> = new Set([API_ERROR_CODES.ORGANIZATION_REQUIRED, API_ERROR_CODES.ORGANIZATION_UNKNOWN]);

function readStored(): string | null {
  try {
    return window.localStorage.getItem(ORGANIZATION_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

let currentSlug: string | null = typeof window === 'undefined' ? null : readStored();

/** Slug of the chosen organization, or null when none is chosen yet. */
export function getOrganizationSlug(): string | null {
  return currentSlug;
}

/** Chooses an organization (null forgets the choice); remembered on this device. */
export function setOrganizationSlug(slug: string | null): void {
  currentSlug = slug;
  try {
    if (slug) window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, slug);
    else window.localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
  } catch {
    // Storage blocked: the choice still holds in memory
  }
}

/** Reads the stored choice again (tests, or another tab changed it). */
export function reloadOrganizationSlug(): string | null {
  currentSlug = readStored();
  return currentSlug;
}

type Listener = () => void;
const rejectedListeners = new Set<Listener>();
const slugListeners = new Set<(slug: string) => void>();

/** Called when the chosen organization's slug was renamed (`followRenamedOrganization`). */
export function onOrganizationSlugRenamed(listener: (slug: string) => void): () => void {
  slugListeners.add(listener);
  return () => slugListeners.delete(listener);
}

/**
 * After an organization's slug was renamed (Beheer): when it is the chosen one, choose the new slug at
 * once, so the very next request sends it (the old one answers 403). Same organization: nothing to forget.
 */
export function followRenamedOrganization(oldSlug: string, newSlug: string): void {
  if (oldSlug === newSlug || oldSlug !== currentSlug) return;
  setOrganizationSlug(newSlug);
  slugListeners.forEach((listener) => listener(newSlug));
}

/**
 * Called when the API refuses the organization: code ORGANIZATION_REQUIRED (401, none sent) or
 * ORGANIZATION_UNKNOWN (403, unknown or inactive). The organization gate then shows the start screen.
 * Other refusals (a 403 for a cross-site write, a wrong API key) don't: their error is shown instead.
 */
export function onOrganizationRejected(listener: Listener): () => void {
  rejectedListeners.add(listener);
  return () => rejectedListeners.delete(listener);
}

export function notifyOrganizationRejected(): void {
  rejectedListeners.forEach((listener) => listener());
}

/** Same-origin `/api` URL? Only those get the header: never a vMix PC, scoreboard or other host. */
export function isSameOriginApiUrl(url: string, origin = window.location.origin): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && (parsed.pathname === '/api' || parsed.pathname.startsWith('/api/'));
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/** Looks at an API answer: does its code say the organization is missing, unknown or inactive? */
async function checkRejected(res: Response): Promise<void> {
  if ((res.status !== 401 && res.status !== 403) || typeof res.clone !== 'function') return;
  try {
    const body = await res.clone().json();
    if (typeof body?.code === 'string' && ORGANIZATION_REJECTED_CODES.has(body.code)) notifyOrganizationRejected();
  } catch {
    // Not JSON: not the organization check
  }
}

const WRAPPED = Symbol.for('korfbal-stream.organization-fetch');

/**
 * Wraps `fetch` once: same-origin `/api` requests get `X-Organization` (unless the caller set it), and
 * an answer that refuses the organization opens the start screen. Call it once at startup.
 */
export function installOrganizationFetch(target: {fetch: typeof fetch} = window): void {
  const original = target.fetch as typeof fetch & {[WRAPPED]?: boolean};
  if (!original || original[WRAPPED]) return;

  const wrapped = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isSameOriginApiUrl(url)) return original.call(target, input, init);

    const slug = getOrganizationSlug();
    let nextInit = init;
    if (slug) {
      const headers = new Headers(init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
      if (!headers.has(ORGANIZATION_HEADER)) headers.set(ORGANIZATION_HEADER, slug);
      nextInit = {...init, headers};
    }
    const res = await original.call(target, input, nextInit);
    void checkRejected(res);
    return res;
  }) as typeof fetch & {[WRAPPED]?: boolean};
  wrapped[WRAPPED] = true;
  target.fetch = wrapped;
}

/** Socket.io `auth` option: called on every (re)connect, so it always sends the current organization. */
export function socketAuth(cb: (data: Record<string, unknown>) => void): void {
  const slug = getOrganizationSlug();
  cb(slug ? {organization: slug} : {});
}

/** Is this `connect_error` the API refusing the organization (`data.code`, services/socket.ts)? */
export function isOrganizationRejectedSocketError(err: unknown): boolean {
  const code = (err as {data?: {code?: unknown}} | undefined)?.data?.code;
  return typeof code === 'string' && ORGANIZATION_REJECTED_CODES.has(code);
}
