import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createFakeSocket} from '../test/fakeSocket';
import VenueBridgeCard from './VenueBridgeCard';

const socket = createFakeSocket();
vi.mock('../lib/socket', () => ({getSharedSocket: () => socket}));

const connected = {
  connected: true, name: 'Zaal Fortuna', version: '1.0.0', pageUrl: 'http://10.0.0.5:3340', connectedAt: '2026-11-05T18:00:00.000Z',
  config: {state: 'applied', error: null},
  devices: {score: {state: 'ok', ageMs: 2000}, clock: {state: 'unreachable', ageMs: 30000}, shotclock: {state: 'not-configured', ageMs: null}},
};

function show(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))));
  render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><VenueBridgeCard/></QueryClientProvider>);
}

describe('VenueBridgeCard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a connected bridge: name, version, devices with age and the link to its page', async () => {
    show(connected);
    expect(await screen.findByText('Verbonden')).toBeInTheDocument();
    expect(screen.getByText('Zaal Fortuna')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Toegepast')).toBeInTheDocument();
    expect(screen.getByText('2 s geleden')).toBeInTheDocument();
    expect(screen.getByText('Niet bereikbaar')).toBeInTheDocument();
    expect(screen.getByText('Niet ingesteld')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'http://10.0.0.5:3340'})).toHaveAttribute('href', 'http://10.0.0.5:3340');
  });

  it('never links to a page address that is not http(s)', async () => {
    show({...connected, pageUrl: 'javascript:alert(1)'});
    expect(await screen.findByText('Zaal Fortuna')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/javascript:/)).toBeNull();
  });

  it('says the venue-bridge is offline when it is not connected', async () => {
    show({...connected, connected: false, name: null, version: null, pageUrl: null, connectedAt: null, config: {state: 'pending', error: null}});
    expect(await screen.findByText('De venue-bridge is offline')).toBeInTheDocument();
    expect(screen.queryByText('Zaal Fortuna')).toBeNull();
  });

  it('shows why the bridge refused the configuration', async () => {
    show({...connected, config: {state: 'refused', error: 'Ongeldige configuratie'}});
    expect(await screen.findByText('Geweigerd')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ongeldige configuratie');
  });
});
