import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import ProductionDetailPage from './ProductionDetailPage';

// The page under test shows the hoofdstukken (openspec/changes/chapters); the rest is mocked
vi.mock('../hooks/useProductions', () => ({
  useProduction: () => ({data: {id: 1, matchScheduleId: 1, liveTime: '2026-11-14T18:25:00.000Z', matchSchedule: {date: '2026-11-14T18:30:00.000Z'}}, isError: false, refetch: vi.fn()}),
  useProductionTiming: () => ({data: [
    {id: 11, naam: 'Voorbereiding', volgorde: 1, duurInMinuten: 5, isTimeAnchor: false, start: '2026-11-14T18:00:00.000Z', end: '2026-11-14T18:05:00.000Z'},
    {id: 22, naam: 'Eerste helft', volgorde: 2, duurInMinuten: 35, isTimeAnchor: false, start: '2026-11-14T18:30:00.000Z', end: '2026-11-14T19:05:00.000Z'},
  ], isError: false, refetch: vi.fn()}),
  useUpdateProduction: () => ({mutateAsync: vi.fn()}),
}));
vi.mock('../hooks/useCallsheet', () => ({useCallSheets: () => ({data: [{id: 7, productionId: 1, name: 'Draaiboek'}], refetch: vi.fn()})}));
vi.mock('../components/CallSheetTemplateSelector', () => ({CallSheetTemplateSelector: () => <div/>}));
const saveCallSheetAsTemplate = vi.fn(async () => ({id: 3, name: 'Kopie'}));
vi.mock('../lib/chaptersApi', () => ({saveCallSheetAsTemplate: (...args: unknown[]) => saveCallSheetAsTemplate(...(args as []))}));

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/producties/1']}>
        <Routes><Route path="/admin/producties/:id" element={<ProductionDetailPage/>}/></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProductionDetailPage hoofdstukken', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the hoofdstukken with their times (Amsterdam) and duration; no segment editing any more', () => {
    renderPage();
    const rows = within(screen.getByRole('table')).getAllByRole('row').map((r) => r.textContent);
    expect(rows).toEqual(['HoofdstukStartEindeDuur', 'LIVESTREAM START19:2519:25', 'Voorbereiding19:0019:055 min', 'Eerste helft19:3020:0535 min']);
    expect(screen.queryByRole('button', {name: /segment/i})).toBeNull();
  });

  it('saves the draaiboek as a new template from the callsheet', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Kopie');
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: 'Sla het draaiboek op als template'}));
    await waitFor(() => expect(saveCallSheetAsTemplate).toHaveBeenCalledWith(7, 'Kopie'));
  });
});
