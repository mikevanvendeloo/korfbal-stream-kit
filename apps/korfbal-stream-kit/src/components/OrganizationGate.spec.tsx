import {act, fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OrganizationGate, OrganizationSwitcher} from './OrganizationGate';
import React from 'react';
import {getOrganizationSlug, installOrganizationFetch, notifyOrganizationRejected} from '../lib/organization';
import {extractError} from '../lib/api';
import {API_ERROR_CODES} from '../lib/apiErrorCodes';
import {chooseOrganization, FORTUNA, jsonResponse, KNKV, mockApi, testOrganization} from '../test/organizations';

const reconnect = vi.fn();
vi.mock('../lib/socket', () => ({reconnectSharedSocket: () => reconnect()}));

/** Shows data that belongs to the organization: what the API answered for it. */
function TenantData() {
  const {data} = useQuery({queryKey: ['sponsors'], queryFn: async () => `sponsors van ${getOrganizationSlug()}`});
  return <p>{data ?? 'laden'}</p>;
}

/** A save action as the Beheer pages have it: the API's error on screen. */
function SaveSponsor() {
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    const res = await fetch('/api/sponsors', {method: 'POST', body: '{}'});
    if (!res.ok) setError(await extractError(res));
  }
  return <>
    <button type="button" onClick={() => void save()}>Opslaan</button>
    {error && <p role="alert">{error}</p>}
  </>;
}

function renderGate(queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})) {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationGate>
        <OrganizationSwitcher/>
        <TenantData/>
        <SaveSponsor/>
      </OrganizationGate>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('OrganizationGate', () => {
  beforeEach(() => reconnect.mockClear());
  afterEach(() => chooseOrganization(null));

  it('shows a large button with logo and name for every active organization', async () => {
    chooseOrganization(null);
    mockApi(() => [FORTUNA, testOrganization(2, 'KNKV', {displayLogoUrl: 'organizations/2.png'})]);
    renderGate();
    expect(await screen.findByRole('heading', {name: 'Kies een organisatie'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Fortuna/})).toHaveTextContent('FO'); // initials without a logo
    expect(screen.getByRole('button', {name: /KNKV/}).querySelector('img')).toHaveAttribute('src', expect.stringContaining('/storage/organizations/2.png'));
    expect(screen.queryByText(/sponsors van/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /KNKV/}));
    expect(await screen.findByText('sponsors van knkv')).toBeInTheDocument();
    expect(window.localStorage.getItem('organization')).toBe('knkv');
  });

  it('chooses the only active organization by itself', async () => {
    chooseOrganization(null);
    mockApi(() => [FORTUNA]);
    renderGate();
    expect(await screen.findByText('sponsors van fortuna')).toBeInTheDocument();
    expect(window.localStorage.getItem('organization')).toBe('fortuna');
  });

  it('shows the app straight away for a stored choice', async () => {
    chooseOrganization('fortuna');
    mockApi(() => [FORTUNA, KNKV]);
    renderGate();
    expect(await screen.findByText('sponsors van fortuna')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Wissel organisatie (nu Fortuna)'})).toBeInTheDocument();
  });

  it('asks again when the stored organization is gone or inactive', async () => {
    chooseOrganization('oud');
    mockApi(() => [FORTUNA, KNKV]);
    renderGate();
    expect(await screen.findByRole('heading', {name: 'Kies een organisatie'})).toBeInTheDocument();
    expect(window.localStorage.getItem('organization')).toBeNull();
  });

  it('asks again when the API refuses the organization (401/403)', async () => {
    chooseOrganization('fortuna');
    mockApi(() => [FORTUNA, KNKV]);
    renderGate();
    expect(await screen.findByText('sponsors van fortuna')).toBeInTheDocument();
    act(() => notifyOrganizationRejected());
    expect(await screen.findByRole('heading', {name: 'Kies een organisatie'})).toBeInTheDocument();
    expect(screen.queryByText('sponsors van fortuna')).not.toBeInTheDocument();
  });

  it('opens the start screen when the API says the organization is unknown (code ORGANIZATION_UNKNOWN)', async () => {
    chooseOrganization('fortuna');
    mockApi(({path}) => path === '/api/organizations' ? [FORTUNA, KNKV]
      : jsonResponse({error: 'Onbekende of inactieve organisatie', code: API_ERROR_CODES.ORGANIZATION_UNKNOWN}, 403));
    installOrganizationFetch(window);
    renderGate();
    fireEvent.click(await screen.findByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByRole('heading', {name: 'Kies een organisatie'})).toBeInTheDocument();
  });

  it('keeps the app for another 403 (e.g. a refused cross-site write) and shows its error', async () => {
    chooseOrganization('fortuna');
    mockApi(({path}) => path === '/api/organizations' ? [FORTUNA, KNKV]
      : jsonResponse({error: 'Verzoek van een andere website geweigerd', code: API_ERROR_CODES.CROSS_SITE_REFUSED}, 403));
    installOrganizationFetch(window);
    renderGate();
    fireEvent.click(await screen.findByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verzoek van een andere website geweigerd');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('heading', {name: 'Kies een organisatie'})).not.toBeInTheDocument();
    expect(screen.getByText('sponsors van fortuna')).toBeInTheDocument();
    expect(getOrganizationSlug()).toBe('fortuna');
  });

  it('forgets the previous organization\'s data and reconnects the socket on switch', async () => {
    chooseOrganization('fortuna');
    mockApi(() => [FORTUNA, KNKV]);
    const queryClient = renderGate();
    expect(await screen.findByText('sponsors van fortuna')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', {name: 'Wissel organisatie (nu Fortuna)'}));
    expect(screen.getByRole('button', {name: /Fortuna/})).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', {name: /KNKV/}));

    expect(await screen.findByText('sponsors van knkv')).toBeInTheDocument();
    expect(screen.queryByText('sponsors van fortuna')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(['sponsors'])).toBe('sponsors van knkv');
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('goes back without changes', async () => {
    chooseOrganization('fortuna');
    mockApi(() => [FORTUNA, KNKV]);
    renderGate();
    fireEvent.click(await screen.findByRole('button', {name: 'Wissel organisatie (nu Fortuna)'}));
    fireEvent.click(screen.getByRole('button', {name: 'Terug'}));
    expect(await screen.findByText('sponsors van fortuna')).toBeInTheDocument();
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('says so when there is no active organization', async () => {
    chooseOrganization(null);
    mockApi(() => []);
    renderGate();
    expect(await screen.findByRole('alert')).toHaveTextContent('Er is geen actieve organisatie');
  });
});
