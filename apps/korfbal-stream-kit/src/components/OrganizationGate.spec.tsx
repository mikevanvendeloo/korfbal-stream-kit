import {act, fireEvent, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OrganizationGate, OrganizationSwitcher} from './OrganizationGate';
import {getOrganizationSlug, notifyOrganizationRejected} from '../lib/organization';
import {chooseOrganization, FORTUNA, KNKV, mockApi, testOrganization} from '../test/organizations';

const reconnect = vi.fn();
vi.mock('../lib/socket', () => ({reconnectSharedSocket: () => reconnect()}));

/** Shows data that belongs to the organization: what the API answered for it. */
function TenantData() {
  const {data} = useQuery({queryKey: ['sponsors'], queryFn: async () => `sponsors van ${getOrganizationSlug()}`});
  return <p>{data ?? 'laden'}</p>;
}

function renderGate(queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})) {
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationGate>
        <OrganizationSwitcher/>
        <TenantData/>
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
