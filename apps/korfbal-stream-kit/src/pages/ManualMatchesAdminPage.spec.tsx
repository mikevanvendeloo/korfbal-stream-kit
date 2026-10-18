import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import ManualMatchesAdminPage from './ManualMatchesAdminPage';

// The test environment runs in UTC (vite.config.ts), not in Amsterdam: the page must still show and
// read Amsterdam time.
const winterMatch = {id: 1, date: '2026-11-07T18:30:00.000Z', homeTeamName: 'Fortuna 1', awayTeamName: 'Ruitenheer 1', refereeName: null, description: null};
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
    expect(within(row).getByText('07-11-2026 19:30')).toBeInTheDocument();
    const summer = screen.getByText('Fortuna 2 vs Ruitenheer 2').closest('tr')!;
    expect(within(summer).getByText('13-06-2026 19:30')).toBeInTheDocument();
  });

  it('shows 07-11-2026 and 19:30 when editing a match stored as 18:30Z, and saves it unchanged', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Fortuna 1 vs Ruitenheer 1 bewerken'}));
    expect((await screen.findByLabelText('Datum') as HTMLInputElement).value).toBe('07-11-2026');
    expect((screen.getByLabelText('Tijd') as HTMLInputElement).value).toBe('19:30');

    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy());
    expect(calls.find((c) => c.method === 'PUT')!.body.date).toBe('2026-11-07T18:30:00.000Z');
  });

  it('saves a changed time of an existing match as Amsterdam time', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Fortuna 1 vs Ruitenheer 1 bewerken'}));
    type(await screen.findByLabelText('Tijd'), '2015');
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toBeTruthy());
    expect(calls.find((c) => c.method === 'PUT')!.body.date).toBe('2026-11-07T19:15:00.000Z');
  });

  it.each([
    ['winter', '07-11-2026', '2026-11-07T18:30:00.000Z'],
    ['summer', '13-06-2026', '2026-06-13T17:30:00.000Z'],
  ])('sends 19:30 typed in %s as Amsterdam time in UTC', async (_season, day, sent) => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe Wedstrijd/}));
    fillNewMatch(day, '19:30');
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeTruthy());
    expect(calls.find((c) => c.method === 'POST')!.body.date).toBe(sent);
  });

  it('uses 24-hour text fields, not native date/time inputs', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe Wedstrijd/}));
    const date = screen.getByLabelText('Datum') as HTMLInputElement;
    const time = screen.getByLabelText('Tijd') as HTMLInputElement;
    expect([date.type, date.inputMode, date.placeholder]).toEqual(['text', 'numeric', 'DD-MM-JJJJ']);
    expect([time.type, time.inputMode, time.placeholder]).toEqual(['text', 'numeric', 'uu:mm']);
  });

  it('requires a date', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe Wedstrijd/}));
    fillNewMatch('', '');
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByText('Datum is verplicht.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it.each([
    ['a time that does not exist', '07-11-2026', '25:00'],
    ['a day that does not exist', '31-02-2026', '19:30'],
    ['a date without a time', '07-11-2026', ''],
  ])('shows a message and does not save %s', async (_case, day, time) => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: /Nieuwe Wedstrijd/}));
    fillNewMatch(day, time);
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByText('Vul een geldige datum (DD-MM-JJJJ) en tijd (uu:mm) in.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('does not save an existing match with an invalid day typed over its date', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Fortuna 1 vs Ruitenheer 1 bewerken'}));
    type(await screen.findByLabelText('Datum'), '31-02-2026');
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    expect(await screen.findByText('Vul een geldige datum (DD-MM-JJJJ) en tijd (uu:mm) in.')).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

/** Types into a field and leaves it, as the crew does (the fields read what was typed on blur). */
function type(field: HTMLElement, text: string) {
  fireEvent.change(field, {target: {value: text}});
  fireEvent.blur(field);
}

function fillNewMatch(day: string, time: string) {
  type(screen.getByLabelText('Datum'), day);
  type(screen.getByLabelText('Tijd'), time);
  fireEvent.change(screen.getByLabelText('Thuisploeg'), {target: {value: 'Fortuna 3'}});
  fireEvent.change(screen.getByLabelText('Uitploeg'), {target: {value: 'Ruitenheer 3'}});
}
