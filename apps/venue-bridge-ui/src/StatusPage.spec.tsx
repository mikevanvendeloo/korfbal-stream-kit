import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import StatusPage, {formatAge} from './StatusPage';
import type {BridgeStatus} from './status';

const base: BridgeStatus = {
  name: 'Zaal Fortuna',
  version: '1.2.3',
  api: {connected: true, since: '2026-11-05T18:00:00.000Z', error: null},
  config: {state: 'applied', source: 'api', version: 'abc123', receivedAt: '2026-11-05T18:00:01.000Z'},
  devices: {score: {state: 'ok', ageMs: 1000}, clock: {state: 'ok', ageMs: 1000}, shotclock: {state: 'not-configured', ageMs: null}},
  hosts: {scoreboard: '192.168.1.20:8080', shotclock: null},
  vmix: [{id: 'a', name: 'Stream-pc', host: '192.168.1.30:8088', state: 'ok', ageMs: 4000}],
  stats: {database: 'enabled', page: 'configured', shareHost: '10.12.0.63', folder: 'set', keepCopy: true},
  fallback: {paths: ['/api/scoreboard', 'POST /api/vmix/set-timer'], key: '********'},
};

function show(status: BridgeStatus | 'down') {
  vi.stubGlobal('fetch', vi.fn(async () => status === 'down' ? new Response('x', {status: 500}) : new Response(JSON.stringify(status), {status: 200})));
  render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><StatusPage/></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('StatusPage', () => {
  it('shows a connected bridge with devices and vMix', async () => {
    show(base);
    expect(await screen.findByText('Verbonden met de API')).toBeInTheDocument();
    expect(screen.getByText('Venue-bridge Zaal Fortuna')).toBeInTheDocument();
    expect(screen.getByText('Scorebord')).toBeInTheDocument();
    expect(screen.getByText('Niet ingesteld')).toBeInTheDocument();
    expect(screen.getByText('Stream-pc')).toBeInTheDocument();
    expect(screen.getByText('4 s geleden')).toBeInTheDocument();
  });

  it('shows "Niet verbonden met de API", the last configuration and the fallback addresses when the cloud is down', async () => {
    show({...base, api: {connected: false, since: null, error: 'timeout'}});
    expect(await screen.findByText('Niet verbonden met de API')).toBeInTheDocument();
    expect(screen.getByText('Laatst ontvangen')).toBeInTheDocument();
    expect(screen.getByText(/werkt door met de laatst ontvangen configuratie/)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/scoreboard\?key=\*{8}/)).toBeInTheDocument();
  });

  it('says a device is not configured instead of showing an age', async () => {
    show(base);
    await screen.findByText('Shotclock');
    expect(screen.getByText('Niet ingesteld')).toBeInTheDocument();
  });

  it('copies a fallback address', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
    show(base);
    fireEvent.click((await screen.findAllByRole('button', {name: /Kopieer/}))[0]);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/api/scoreboard?key=********'));
    await screen.findByText('Gekopieerd');
  });

  it('shows that the statistics come from the local copy while the share is skipped', async () => {
    const now = Date.now();
    const iso = (ago: number) => new Date(now - ago).toISOString();
    show({...base, stats: {...base.stats, share: {
      shareReadAt: iso(600_000), shareCheckedAt: iso(300_000), lastError: {message: 'De gedeelde map antwoordt niet', at: iso(5000)},
      failures: 3, skipUntil: new Date(now + 20_000).toISOString(), hostReachable: false,
      fileModifiedAt: iso(610_000), fileBytes: 3 * 1024 * 1024, copyWrittenAt: iso(600_000), copyError: null, parseMs: 420,
      lastAnswer: {source: 'copy', readAt: iso(600_000), team: '1', at: iso(1000)},
    }}});
    expect(await screen.findByText('Van de lokale kopie')).toBeInTheDocument();
    expect(screen.getByText(/Overgeslagen tot .* \(3× mislukt\)/)).toBeInTheDocument();
    expect(screen.getByText(/De gedeelde map antwoordt niet/)).toBeInTheDocument();
    expect(screen.getByText('Nee')).toBeInTheDocument();
    expect(screen.getByText(/ingelezen in 420 ms/)).toBeInTheDocument();
    expect(screen.getByText(/3\.0 MB/)).toBeInTheDocument();
  });

  it('says the statistics folder is not mounted', async () => {
    show({...base, stats: {...base.stats, folder: 'not set'}});
    expect(await screen.findByText('Niet gekoppeld (STATS_DIR)')).toBeInTheDocument();
  });

  it('tells when the bridge itself cannot be reached', async () => {
    show('down');
    expect(await screen.findByRole('alert')).toHaveTextContent('niet bereikbaar');
  });

  it('formats ages', () => {
    expect(formatAge(null)).toBe('geen meting');
    expect(formatAge(2000)).toBe('2 s geleden');
    expect(formatAge(125000)).toBe('2 min geleden');
  });
});
