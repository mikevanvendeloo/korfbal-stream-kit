import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  getOrganizationSlug,
  installOrganizationFetch,
  isOrganizationRejectedSocketError,
  isSameOriginApiUrl,
  onOrganizationRejected,
  ORGANIZATION_HEADER,
  ORGANIZATION_SLUG_PATTERN,
  setOrganizationSlug,
  socketAuth,
} from './organization';
import {API_ERROR_CODES} from './apiErrorCodes';
import {chooseOrganization, jsonResponse} from '../test/organizations';

/** A fetch target with a fake original fetch, wrapped like window.fetch is at startup. */
function wrappedFetch(answer: Response = jsonResponse({})) {
  const original = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => answer);
  const target = {fetch: original as unknown as typeof fetch};
  installOrganizationFetch(target);
  const sentHeaders = (call = 0) => new Headers(original.mock.calls[call][1]?.headers);
  return {target, original, sentHeaders};
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('organization fetch wrapper', () => {
  beforeEach(() => chooseOrganization('fortuna'));
  afterEach(() => chooseOrganization(null));

  it('adds X-Organization to same-origin /api requests', async () => {
    const {target, sentHeaders} = wrappedFetch();
    await target.fetch('/api/sponsors');
    expect(sentHeaders().get(ORGANIZATION_HEADER)).toBe('fortuna');

    await target.fetch(new URL('/api/production/active', window.location.origin));
    expect(sentHeaders(1).get(ORGANIZATION_HEADER)).toBe('fortuna');
  });

  it('keeps the caller\'s headers, and a header the caller set itself', async () => {
    const {target, sentHeaders} = wrappedFetch();
    await target.fetch('/api/sponsors', {method: 'POST', headers: {'Content-Type': 'application/json'}});
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
    expect(sentHeaders().get(ORGANIZATION_HEADER)).toBe('fortuna');

    await target.fetch('/api/sponsors', {headers: {[ORGANIZATION_HEADER]: 'knkv'}});
    expect(sentHeaders(1).get(ORGANIZATION_HEADER)).toBe('knkv');
  });

  it('never sends the organization to another host or outside /api', async () => {
    const {target, original} = wrappedFetch();
    await target.fetch('http://192.168.1.20:8088/api/?Function=SetText');
    await target.fetch('/storage/sponsors/1/logo.png');
    await target.fetch('/apiary');
    for (const [, init] of original.mock.calls) expect(new Headers(init?.headers).has(ORGANIZATION_HEADER)).toBe(false);
  });

  it('sends nothing extra when no organization is chosen', async () => {
    chooseOrganization(null);
    const {target, sentHeaders} = wrappedFetch();
    await target.fetch('/api/organizations');
    expect(sentHeaders().has(ORGANIZATION_HEADER)).toBe(false);
  });

  it('wraps only once', () => {
    const {target} = wrappedFetch();
    const once = target.fetch;
    installOrganizationFetch(target);
    expect(target.fetch).toBe(once);
  });

  it('opens the start screen only for the API\'s organization codes, never on the text', async () => {
    const rejected = vi.fn();
    const stop = onOrganizationRejected(rejected);
    const answer = async (body: unknown, status: number, path = '/api/sponsors') => {
      await wrappedFetch(jsonResponse(body, status)).target.fetch(path);
      await flush();
    };
    try {
      await answer({error: 'Onbekende of inactieve organisatie', code: API_ERROR_CODES.ORGANIZATION_UNKNOWN}, 403);
      expect(rejected).toHaveBeenCalledTimes(1);
      await answer({error: 'Kies een organisatie', code: API_ERROR_CODES.ORGANIZATION_REQUIRED}, 401);
      expect(rejected).toHaveBeenCalledTimes(2);

      // Other refusals show their own error: choosing again wouldn't help
      await answer({error: 'Verzoek van een andere website geweigerd', code: API_ERROR_CODES.CROSS_SITE_REFUSED}, 403);
      await answer({error: 'Iets anders verboden'}, 403);
      await answer({error: 'Niet gevonden'}, 404, '/api/sponsors/9');
      await answer({error: 'Ongeldige API-sleutel', code: API_ERROR_CODES.API_KEY_INVALID}, 401, '/api/vmix/sponsor-names');
      // The same text without the code: the kit matches on the code, not the message
      await answer({error: 'Onbekende of inactieve organisatie'}, 403);
      await answer({error: 'Kies een organisatie'}, 401);
      expect(rejected).toHaveBeenCalledTimes(2);
    } finally {
      stop();
    }
  });

  it('recognises a refused socket handshake by its data.code', () => {
    const refused = Object.assign(new Error('Onbekende of inactieve organisatie'), {data: {code: API_ERROR_CODES.ORGANIZATION_UNKNOWN}});
    expect(isOrganizationRejectedSocketError(refused)).toBe(true);
    expect(isOrganizationRejectedSocketError(new Error('Onbekende of inactieve organisatie'))).toBe(false);
    expect(isOrganizationRejectedSocketError(Object.assign(new Error('Verbinding geweigerd'), {data: {code: 'OTHER'}}))).toBe(false);
    expect(isOrganizationRejectedSocketError(undefined)).toBe(false);
  });

  it('checks a slug with the API\'s rule', () => {
    expect(ORGANIZATION_SLUG_PATTERN.test('fortuna-ruitenheer')).toBe(true);
    for (const slug of ['met spatie', 'Hoofd', '-voor', 'achter-', 'dubbel--streep', 'under_score']) {
      expect(ORGANIZATION_SLUG_PATTERN.test(slug), slug).toBe(false);
    }
  });

  it('only wraps same-origin /api URLs', () => {
    expect(isSameOriginApiUrl('/api')).toBe(true);
    expect(isSameOriginApiUrl(`${window.location.origin}/api/x`)).toBe(true);
    expect(isSameOriginApiUrl('https://evil.example/api/x')).toBe(false);
    expect(isSameOriginApiUrl('/uploads/x.png')).toBe(false);
  });
});

describe('the chosen organization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    chooseOrganization(null);
  });

  it('is stored on the device', () => {
    setOrganizationSlug('knkv');
    expect(window.localStorage.getItem('organization')).toBe('knkv');
    setOrganizationSlug(null);
    expect(window.localStorage.getItem('organization')).toBeNull();
  });

  it('still holds in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setOrganizationSlug('knkv');
    expect(getOrganizationSlug()).toBe('knkv');
  });

  it('goes along with the socket handshake', () => {
    const cb = vi.fn();
    chooseOrganization('fortuna');
    socketAuth(cb);
    expect(cb).toHaveBeenLastCalledWith({organization: 'fortuna'});
    chooseOrganization(null);
    socketAuth(cb);
    expect(cb).toHaveBeenLastCalledWith({});
  });
});
