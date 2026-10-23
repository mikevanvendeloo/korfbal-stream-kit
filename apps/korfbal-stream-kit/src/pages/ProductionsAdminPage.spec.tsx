import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import ProductionsAdminPage from './ProductionsAdminPage';
import React from "react";

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

const roles = (regisseur: number, camera: number) => [
  {key: 'regisseur', label: 'Regisseur', required: 1, filled: regisseur, optional: false, met: regisseur >= 1},
  {key: 'camera', label: 'Camera', required: 3, filled: camera, optional: false, met: camera >= 3},
  {key: 'commentaar', label: 'Commentaar', required: 1, filled: 0, optional: true, met: false},
];
const match = (id: number, home: string) => ({id, homeTeamName: home, awayTeamName: 'Opp', date: '2026-11-14T18:30:00.000Z'});
const FIRST = {id: 1, matchScheduleId: 100, matchSchedule: match(100, 'Fortuna/Ruitenheer 1')};
let listed: any[] = [FIRST];

describe('ProductionsAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    listed = [FIRST];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url);

      // List productions
      if (u.pathname.endsWith('/api/production') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: listed, total: listed.length }) } as any;
      }
      // Matches for selection
      if (u.pathname.endsWith('/api/production/matches') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 100, date: new Date().toISOString(), homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opp' },
          { id: 101, date: new Date().toISOString(), homeTeamName: 'Fortuna/Ruitenheer 2', awayTeamName: 'Opp2' },
        ], filters: [] }) } as any;
      }
      // Create production
      if (u.pathname.endsWith('/api/production') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 2, matchScheduleId: 101, createdAt: new Date().toISOString() }) } as any;
      }
      // Update production
      if (u.pathname.match(/\/api\/production\/\d+$/) && init?.method === 'PUT') {
        return { ok: true, json: async () => ({ id: 1, matchScheduleId: 101 }) } as any;
        }
      // Delete production
      if (u.pathname.match(/\/api\/production\/\d+$/) && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) } as any;
      }
      // Persons list - now at /api/persons
      if (u.pathname === '/api/persons' && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [ { id: 1, name: 'Alice', gender: 'female', createdAt: new Date().toISOString() } ], page: 1, limit: 100, total: 1, pages: 1 }) } as any;
      }

      return { ok: false, status: 404 } as any;
    });
  });

  it('renders the productions list', async () => {
    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Check that the production from mock data is rendered
    expect(screen.getByText(/Fortuna\/Ruitenheer 1/)).toBeInTheDocument();
    expect(screen.getByText(/vs/)).toBeInTheDocument();
    expect(screen.getByText(/Opp/)).toBeInTheDocument();
  });

  it('has no ID column', async () => {
    renderWithProviders(<ProductionsAdminPage />);
    await screen.findByText(/Fortuna\/Ruitenheer 1/);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Datum/Tijd', 'Match', 'Bezetting', 'Acties']);
    // The id (1) isn't shown as a cell of its own
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).not.toContain('1');
  });

  it('can create a production by selecting a match', async () => {
    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Click "Nieuw" button to open create dialog
    fireEvent.click(screen.getByText(/Nieuw/));

    // Wait for dialog and match select to appear
    const select = await screen.findByLabelText('Select match') as HTMLSelectElement;
    expect(select).toHaveFocus();

    // Select a match (Fortuna/Ruitenheer 2 with id 101)
    fireEvent.change(select, { target: { value: '101' } });
    expect(select.value).toBe('101');

    // Save the production
    fireEvent.click(screen.getByText('Opslaan'));

    // Verify POST call was made with correct match ID
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const hasProductionPost = calls.some((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/api/production') && call[1]?.method === 'POST' && call[1]?.body?.includes('101');
      });
      expect(hasProductionPost).toBe(true);
    });
  });

  it('shows per production whether the minimum staffing is met, linking to Beschikbaarheid', async () => {
    listed = [
      {...FIRST, staffing: {presentCount: 4, met: true, shortfall: [], roles: roles(1, 3)}},
      {id: 2, matchScheduleId: 101, matchSchedule: match(101, 'Fortuna/Ruitenheer 2'),
        staffing: {presentCount: 2, met: false, shortfall: [{key: 'camera', missing: 1, singular: 'camera', plural: "camera's"}], roles: roles(1, 2)}},
      {id: 3, matchScheduleId: 102, matchSchedule: match(102, 'Fortuna/Ruitenheer 3'),
        staffing: {presentCount: 0, met: false, shortfall: [
          {key: 'regisseur', missing: 1, singular: 'regisseur', plural: 'regisseurs'},
          {key: 'camera', missing: 3, singular: 'camera', plural: "camera's"},
        ], roles: roles(0, 0)}},
    ];
    renderWithProviders(<ProductionsAdminPage />);

    const met = await screen.findByTestId('staffing-1');
    expect(met.textContent).toBe('✓ Gehaald');
    expect(met.className).toContain('bg-green-100');
    expect(met.getAttribute('href')).toBe('/admin/producties/1/beschikbaarheid');
    expect(met.getAttribute('title')).toContain('Regisseur: 1/1 ✓');
    expect(met.getAttribute('title')).toContain('Commentaar (optioneel): 0/1 ✗');

    const short = screen.getByTestId('staffing-2');
    expect(short.textContent).toBe('✗ nog 1 camera');
    expect(short.className).toContain('bg-amber-100');
    expect(short.getAttribute('title')).toContain('Camera: 2/3 ✗');

    const nobody = screen.getByTestId('staffing-3');
    expect(nobody.textContent).toBe('Nog niemand aanwezig');
    expect(nobody.className).toContain('text-gray-600');

    // Never wider than a phone screen: the text truncates, the table scrolls in its own box
    for (const badge of [met, short, nobody]) expect(badge.className).toContain('truncate');
    expect(met.closest('table')?.parentElement?.className).toContain('overflow-x-auto');
  });

  it('shows attendance button for each production', async () => {
    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Check that attendance button is present
    const attendanceButton = screen.getByLabelText('Aanwezigheid beheren');
    expect(attendanceButton).toBeInTheDocument();
  });
});
