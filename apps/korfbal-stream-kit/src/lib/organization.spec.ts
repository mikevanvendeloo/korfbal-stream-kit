import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  getOrganizationSlug,
  installOrganizationFetch,
  isSameOriginApiUrl,
  onOrganizationRejected,
  ORGANIZATION_HEADER,
  setOrganizationSlug,
  socketAuth,
} from './organization';
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

  it('reports a 403 and a 401 "Kies een organisatie", not other errors', async () => {
    const rejected = vi.fn();
    const stop = onOrganizationRejected(rejected);
    try {
      await wrappedFetch(jsonResponse({error: 'Onbekende of inactieve organisatie'}, 403)).target.fetch('/api/sponsors');
      await flush();
      expect(rejected).toHaveBeenCalledTimes(1);

      await wrappedFetch(jsonResponse({error: 'Kies een organisatie'}, 401)).target.fetch('/api/sponsors');
      await flush();
      expect(rejected).toHaveBeenCalledTimes(2);

      await wrappedFetch(jsonResponse({error: 'Niet gevonden'}, 404)).target.fetch('/api/sponsors/9');
      await wrappedFetch(jsonResponse({error: 'Ongeldige API-sleutel'}, 401)).target.fetch('/api/vmix/sponsor-names');
      await flush();
      expect(rejected).toHaveBeenCalledTimes(2);
    } finally {
      stop();
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
