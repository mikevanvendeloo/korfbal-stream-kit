import {vi} from 'vitest';
import type React from 'react';
import {render} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import type {Organization} from '../hooks/useOrganizations';
import {ORGANIZATION_STORAGE_KEY, reloadOrganizationSlug} from '../lib/organization';

/**
 * Shared test data for organizations: build what a test needs from these, so a change to the
 * organization DTO is made here once.
 */
export function testOrganization(id: number, name: string, extra: Partial<Organization> = {}): Organization {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id, slug, name, logoUrl: null, clubId: null, isActive: true, createdAt: '2026-10-01T00:00:00.000Z',
    displayLogoUrl: null, initials: name.slice(0, 2).toUpperCase(), ...extra,
  };
}

export const FORTUNA = testOrganization(1, 'Fortuna');
export const KNKV = testOrganization(2, 'KNKV');

/** Makes `slug` the chosen organization (as if picked on the start screen), or forgets the choice. */
export function chooseOrganization(slug: string | null): void {
  if (slug) window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, slug);
  else window.localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
  reloadOrganizationSlug();
}

/** A JSON answer for a mocked fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: new Headers({'content-type': 'application/json'}),
    json: async () => body,
    clone() { return jsonResponse(body, status); },
  } as unknown as Response;
}

export type ApiCall = { method: string; path: string; body: unknown; headers: Headers };

/**
 * Replaces global fetch with a small API: `handler` gets method, path (with query) and the JSON body,
 * and returns a JSON body (or a Response). Every call is kept in `calls`.
 */
export function mockApi(handler: (call: ApiCall) => unknown) {
  const calls: ApiCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url, 'http://localhost');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body ?? null;
    const call = {method: init?.method ?? 'GET', path: url.pathname + url.search, body, headers: new Headers(init?.headers)};
    calls.push(call);
    const result = handler(call);
    return result instanceof Object && 'status' in (result as object) && 'json' in (result as object) ? result as Response : jsonResponse(result ?? {});
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return {calls, fetchMock};
}

/** Renders a Beheer page with a fresh query client and a router. */
export function renderPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={queryClient}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}
