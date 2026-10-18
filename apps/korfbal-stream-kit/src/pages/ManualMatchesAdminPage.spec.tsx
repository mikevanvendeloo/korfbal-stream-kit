import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import ManualMatchesAdminPage from './ManualMatchesAdminPage';

// The test environment runs in UTC (vite.config.ts), not in Amsterdam: the page must still show and
// read Amsterdam time.
const winterMatch = {id: 1, date: '2026-11-14T18:30:00.000Z', homeTeamName: 'Fortuna 1', awayTeamName: 'Ruitenheer 1', refereeName: null, description: null};
const summerMatch = {id: 2, date: '2026-06-13T17:30:00.000Z', homeTeamName: 'Fortuna 2', awayTeamName: 'Ruitenheer 2', refereeName: null, description: null};

type Call = { method: string; url: string; body: any };
let calls: Call[] = [];

function renderPage() {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(<QueryClientProvider client={qc}><ManualMatchesAdminPage/></QueryClientProvider>);
}

describe('ManualMatchesAdminPage (Amsterdam time on a device in another zone)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    calls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({method, url, body});
      if (method === 'GET') return {ok: true, json: async () => [winterMatch, summerMatch]} as any;
      return {ok: true, json: async () => ({id: 9, ...body})} as any;
    });
  });

  it('lists the matches in Amsterdam time', async () => {
    renderPage();
    const row = (await screen.findByText('Fortuna 1 vs Ruitenheer 1')).closest('tr')!;
    expect(within(row).getByText('14-11-2026 19:30')).toBeInTheDocument();
    const summer = screen.getByText('Fortuna 2 vs Ruitenheer 2').closest('tr')!;
    expect(within(summer).getByText('13-06-2026 19:30')).toBeInTheDocument();
  });

  it('shows 19:30 when editing a match stored as 18:30Z, and saves it unchanged', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Fortuna 1 vs Ruitenheer 1 bewerken'}));
    const field = await screen.findByLabelText('Datum & Tijd') as HTMLInputElement;
    expect(field.value).toBe('2026-11-14T19:30');

    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy());
    expect(calls.find((c) => c.method === 'PUT')!.body.date).toBe('2026-11-14T18:30:00.000Z');
  });

  it.each([
    ['winter', '2026-11-14T19:30', '2026-11-14T18:30:00.000Z'],
    ['summer', '2026-06-13T19:30', '2026-06-13T17:30:00.000Z'],
  ])('sends 19:30 typed in %s as Amsterdam time in UTC', async (_season, typed, sent) => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe Wedstrijd/}));
    fireEvent.change(screen.getByLabelText('Datum & Tijd'), {target: {value: typed}});
    fireEvent.change(screen.getByLabelText('Thuisploeg'), {target: {value: 'Fortuna 3'}});
    fireEvent.change(screen.getByLabelText('Uitploeg'), {target: {value: 'Ruitenheer 3'}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeTruthy());
    expect(calls.find((c) => c.method === 'POST')!.body.date).toBe(sent);
  });
});
