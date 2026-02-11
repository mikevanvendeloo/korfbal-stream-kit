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

describe('ProductionsAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url);

      // List productions
      if (u.pathname.endsWith('/api/production') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 1, matchScheduleId: 100, createdAt: new Date().toISOString(), matchSchedule: { id: 100, homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opp' } },
        ], total: 1 }) } as any;
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

  it('shows attendance button for each production', async () => {
    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Check that attendance button is present
    const attendanceButton = screen.getByLabelText('Aanwezigheid beheren');
    expect(attendanceButton).toBeInTheDocument();
  });
});
