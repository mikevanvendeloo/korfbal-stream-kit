import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import StatisticsSettings from './StatisticsSettings';

const stored = {pageUrl: 'http://10.0.0.1/klassiek.html', mdbPath: 'Data/WEDSTRIJDEN.mdb', mdbEnabled: true, shareHost: '10.0.0.1', keepCopy: true};

function setup(putAnswer: Response | null = null) {
  const calls: {method: string; body: unknown}[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({method, body: init?.body ? JSON.parse(String(init.body)) : undefined});
    if (method === 'PUT' && putAnswer) return putAnswer;
    return new Response(JSON.stringify(init?.body ? JSON.parse(String(init.body)) : stored));
  }));
  render(<QueryClientProvider client={new QueryClient()}><StatisticsSettings/></QueryClientProvider>);
  return calls;
}

describe('StatisticsSettings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the settings and saves them in the new shape', async () => {
    const calls = setup();
    const mdb = await screen.findByLabelText('Pad van de database');
    await waitFor(() => expect((mdb as HTMLInputElement).value).toBe('Data/WEDSTRIJDEN.mdb'));
    fireEvent.click(screen.getByLabelText('Lokale kopie van de database bewaren'));
    fireEvent.change(screen.getByLabelText('Adres van de statistiek-pc'), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'Statistieken opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({...stored, shareHost: null, keepCopy: false}));
    expect(await screen.findByText('Statistiekeninstellingen opgeslagen')).toBeInTheDocument();
  });

  it('shows the API message when the path is refused', async () => {
    setup(new Response(JSON.stringify({error: 'Het databasepad moet relatief zijn (zonder ..) en op .mdb of .accdb eindigen'}), {status: 400, headers: {'Content-Type': 'application/json'}}));
    const mdb = await screen.findByLabelText('Pad van de database');
    await waitFor(() => expect((mdb as HTMLInputElement).value).toBe('Data/WEDSTRIJDEN.mdb'));
    fireEvent.change(mdb, {target: {value: '../WEDSTRIJDEN.mdb'}});
    fireEvent.click(screen.getByRole('button', {name: 'Statistieken opslaan'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Het databasepad moet relatief zijn');
  });
});
