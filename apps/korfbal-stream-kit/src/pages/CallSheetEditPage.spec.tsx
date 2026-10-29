import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import CallSheetEditPage from './CallSheetEditPage';

// A production's draaiboek in hoofdstukken (openspec/changes/chapters): the API is faked per path
type Call = { method: string; path: string; body: any };
let calls: Call[] = [];

const items = [
  {id: 'a', callSheetId: 5, chapterId: 11, cue: 'START', title: 'Livestream starten', durationSec: 0, orderIndex: 1, isTimeAnchor: true, anchorType: 'LIVESTREAM_START', timeStart: '2026-11-14T18:25:00.000Z', positions: [{positionId: 1}, {positionId: 2}]},
  {id: 'b', callSheetId: 5, chapterId: 22, cue: '', title: 'Eerste helft', durationSec: 2100, orderIndex: 2, timeStart: '2026-11-14T18:30:00.000Z', positions: [{positionId: 1}]},
];

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

describe('CallSheetEditPage (hoofdstukken)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    calls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const path = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost').pathname;
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({method, path, body});
      const json = (data: unknown) => ({ok: true, json: async () => data}) as Response;
      if (method === 'GET' && path.endsWith('/callsheets/5')) return json({id: 5, name: 'Draaiboek', items});
      if (method === 'GET' && path.endsWith('/production/3/chapters')) return json([{id: 11, productionId: 3, name: 'Voorbeschouwing', orderIndex: 1}, {id: 22, productionId: 3, name: 'Eerste helft', orderIndex: 2}]);
      if (method === 'GET' && path.endsWith('/production/positions')) return json([{id: 1, name: 'Showcaller', category: 'GENERAL'}, {id: 2, name: 'Regie livestream', category: 'TECHNICAL'}]);
      if (method === 'GET' && path.endsWith('/production/3')) return json({id: 3, chaptersAutoPlaced: false});
      if (method === 'GET') return json([]);
      if (method === 'POST' && path.endsWith('/items')) return json({id: 'nieuw', ...body});
      return json({ok: true});
    });
  });

  it('shows the hoofdstukken with their items as quiet lines with the cue', async () => {
    renderPage();
    const voor = await screen.findByRole('region', {name: 'Hoofdstuk Voorbeschouwing'});
    expect(within(voor).getByRole('button', {name: 'Livestream starten openen'}).textContent).toContain('START');
    expect(within(voor).getByText('Regie livestream')).toBeTruthy();
    expect(within(voor).queryByText('Showcaller')).toBeNull();
    expect(within(screen.getByRole('region', {name: 'Hoofdstuk Eerste helft'})).getByText('Eerste helft', {selector: 'span'})).toBeTruthy();
  });

  it('adds a new item at the end of a hoofdstuk, with Showcaller', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Item toevoegen aan Voorbeschouwing'}));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT' && c.path.endsWith('/callsheets/5/structure'))).toBeTruthy());
    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith('/callsheets/5/items'));
    expect(post?.body).toMatchObject({title: 'Nieuw item', chapterId: 11, positionIds: [1]});
    const structure = calls.find((c) => c.method === 'PUT' && c.path.endsWith('/structure'));
    expect(structure?.body).toEqual({chapters: [{id: 11, itemIds: ['a', 'nieuw']}, {id: 22, itemIds: ['b']}]});
  });
});
