import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFakeSocket} from '../../test/fakeSocket';
import VenueSettingsTab from './VenueSettingsTab';

const socket = createFakeSocket();
vi.mock('../../lib/socket', () => ({getSharedSocket: () => socket}));

const json = (data: unknown) => new Response(JSON.stringify(data));
const BRIDGE = {
  connected: true, name: 'Zaal', version: '1.0.0', pageUrl: null, connectedAt: '2026-11-05T18:00:00.000Z',
  config: {state: 'applied', error: null},
  devices: {score: {state: 'ok', ageMs: 1000}, clock: {state: 'ok', ageMs: 1000}, shotclock: {state: 'ok', ageMs: 1000}},
};

describe('VenueSettingsTab', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let bridge: typeof BRIDGE;
  beforeEach(() => {
    bridge = BRIDGE;
    fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/venue-bridge/status')) return json(bridge);
      if (u.includes('/api/settings/scoreboard-config')) return json(init?.body ? JSON.parse(String(init.body)) : {scoreboardUrl: 'http://score.test', shotclockUrl: 'http://shot.test'});
      if (u.includes('/api/settings/match-stats')) return json({pageUrl: null, mdbPath: null, mdbEnabled: true, shareHost: null, keepCopy: true});
      if (u.includes('/api/settings/vmix-instances')) return json({instances: [{id: 'a', name: 'Stream-pc', url: 'http://10.0.0.10:8088'}], targets: {countdown: '', callsheet: ''}});
      return new Response('{}', {status: 404});
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderTab = () => render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MemoryRouter><VenueSettingsTab/></MemoryRouter></QueryClientProvider>);

  it('has the bridge status on top and the scoreboard, statistics and vMix settings below it', async () => {
    renderTab();
    expect(await screen.findByText('Zaal')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/scoreboard base url/i)).toHaveValue('http://score.test'));
    expect(screen.getByLabelText(/shotclock base url/i)).toHaveValue('http://shot.test');
    expect(screen.getByRole('heading', {name: 'Statistieken'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: "vMix-pc's"})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Stream-pc verwijderen'})).toBeInTheDocument();
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings.indexOf('Venue-bridge')).toBeLessThan(headings.indexOf('Scorebord & Shotclock'));
  });

  it('shows the bridge as offline when it is not connected', async () => {
    bridge = {...BRIDGE, connected: false, name: null} as unknown as typeof BRIDGE;
    renderTab();
    expect(await screen.findByText('De venue-bridge is offline')).toBeInTheDocument();
  });

  it('saves the scoreboard settings', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByLabelText(/scoreboard base url/i)).toHaveValue('http://score.test'));
    fireEvent.change(screen.getByLabelText(/scoreboard base url/i), {target: {value: 'http://new-score.url'}});
    fireEvent.click(screen.getByRole('button', {name: /scorebord opslaan/i}));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/settings/scoreboard-config') && c[1]?.method === 'PUT');
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({scoreboardUrl: 'http://new-score.url', shotclockUrl: 'http://shot.test'});
    });
    expect(await screen.findByText(/verbindingsinstellingen opgeslagen/i)).toBeInTheDocument();
  });
});
