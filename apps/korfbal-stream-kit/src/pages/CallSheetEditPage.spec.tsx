import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import CallSheetEditPage from './CallSheetEditPage';

// The test environment runs in UTC (vite.config.ts), not in Amsterdam: the new item's fields must
// still mean Amsterdam time.
type Call = { method: string; url: string; body: any };
let calls: Call[] = [];

function renderPage() {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/producties/3/callsheets/5']}>
        <Routes>
          <Route path="/admin/producties/:id/callsheets/:callSheetId" element={<CallSheetEditPage/>}/>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Types into a field and leaves it (the fields read what was typed on blur). */
function type(field: HTMLElement, text: string) {
  fireEvent.change(field, {target: {value: text}});
  fireEvent.blur(field);
}

async function fillNewItem() {
  fireEvent.change(await screen.findByPlaceholderText('Bv. PRE_MATCH'), {target: {value: 'START'}});
  fireEvent.change(screen.getByPlaceholderText('Titel van het item'), {target: {value: 'Aftrap'}});
}

const posted = () => calls.find((c) => c.method === 'POST' && c.url.endsWith('/items'));

describe('CallSheetEditPage new item times (24-hour, Amsterdam time)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    calls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({method, url, body});
      if (method === 'GET' && url.endsWith('/callsheets/5')) return {ok: true, json: async () => ({id: 5, name: 'Draaiboek', items: []})} as any;
      if (method === 'GET') return {ok: true, json: async () => []} as any;
      return {ok: true, json: async () => ({id: 'x', ...body})} as any;
    });
  });

  it('sends start 07-11-2026 19:30 and end 19:45 as UTC', async () => {
    renderPage();
    await fillNewItem();
    type(screen.getByLabelText('Begin Datum'), '07-11-2026');
    type(screen.getByLabelText('Begin Tijd'), '19:30');
    type(screen.getByLabelText('Einde Datum'), '7-11-2026');
    type(screen.getByLabelText('Einde Tijd'), '1945');
    fireEvent.click(screen.getByRole('button', {name: /Item toevoegen aan callsheet/}));
    await waitFor(() => expect(posted()).toBeTruthy());
    expect(posted()!.body.timeStart).toBe('2026-11-07T18:30:00.000Z');
    expect(posted()!.body.timeEnd).toBe('2026-11-07T18:45:00.000Z');
  });

  it('leaves the times out when the fields are empty', async () => {
    renderPage();
    await fillNewItem();
    fireEvent.click(screen.getByRole('button', {name: /Item toevoegen aan callsheet/}));
    await waitFor(() => expect(posted()).toBeTruthy());
    expect(posted()!.body.timeStart).toBeUndefined();
    expect(posted()!.body.timeEnd).toBeUndefined();
  });

  it.each([
    ['25:00 as a time', '07-11-2026', '25:00'],
    ['31-02-2026 as a day', '31-02-2026', '19:30'],
    ['a day without a time', '07-11-2026', ''],
  ])('shows a message and does not add the item for %s', async (_case, day, time) => {
    renderPage();
    await fillNewItem();
    type(screen.getByLabelText('Begin Datum'), day);
    type(screen.getByLabelText('Begin Tijd'), time);
    fireEvent.click(screen.getByRole('button', {name: /Item toevoegen aan callsheet/}));
    expect(await screen.findByText('Begin: Vul een geldige datum (DD-MM-JJJJ) en tijd (uu:mm) in.')).toBeInTheDocument();
    expect(posted()).toBeUndefined();
  });
});
