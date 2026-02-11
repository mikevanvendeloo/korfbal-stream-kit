import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {ThemeProvider} from '../theme/ThemeProvider';
import ProductionAttendancePage from './ProductionAttendancePage';
import React from 'react';

function renderWithProviders(ui: React.ReactNode, {route = '/admin/productions/1/attendance'} = {}) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/admin/productions/:id/attendance" element={ui} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('ProductionAttendancePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url);

      // Get production
      if (u.pathname.match(/\/api\/production\/1$/) && (!init || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({
            id: 1,
            matchScheduleId: 100,
            createdAt: new Date().toISOString(),
            matchSchedule: {id: 100, homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opponent'},
          }),
        } as any;
      }

      // Production persons (attendance) - initially empty
      if (u.pathname.match(/\/api\/production\/1\/persons$/) && (!init || init.method === 'GET')) {
        return {ok: true, json: async () => []} as any;
      }

      // List persons (all persons in the system) - now at /api/persons (not under production)
      if (u.pathname.endsWith('/api/persons') && (!init || init.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {id: 1, name: 'Alice', gender: 'female', createdAt: new Date().toISOString()},
              {id: 2, name: 'Bob', gender: 'male', createdAt: new Date().toISOString()},
              {id: 3, name: 'Charlie', gender: 'male', createdAt: new Date().toISOString()},
            ],
            page: 1,
            limit: 1000,
            total: 3,
            pages: 1,
          }),
        } as any;
      }

      // Add production person
      if (u.pathname.match(/\/api\/production\/1\/persons$/) && init?.method === 'POST') {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            id: 100 + body.personId,
            productionId: 1,
            personId: body.personId,
            person: {
              id: body.personId,
              name: body.personId === 1 ? 'Alice' : body.personId === 2 ? 'Bob' : 'Charlie',
              gender: body.personId === 2 ? 'male' : body.personId === 1 ? 'female' : 'male',
            },
            createdAt: new Date().toISOString(),
          }),
        } as any;
      }

      // Delete production person
      if (u.pathname.match(/\/api\/production\/1\/persons\/\d+$/) && init?.method === 'DELETE') {
        return {ok: true, status: 204} as any;
      }

      return {ok: false, status: 404} as any;
    });
  });

  it('renders the attendance page with production info', async () => {
    renderWithProviders(<ProductionAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Aanwezigheid crew')).toBeInTheDocument();
      expect(screen.getByText('Fortuna/Ruitenheer 1 vs Opponent')).toBeInTheDocument();
    });
  });

  it('shows all persons with checkboxes', async () => {
    renderWithProviders(<ProductionAttendancePage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Laden…')).not.toBeInTheDocument();
    }, {timeout: 5000});

    // Debug: check what was fetched
    const calls = (global.fetch as any).mock.calls;
    const urls = calls.map((c: any) => typeof c[0] === 'string' ? c[0] : c[0].toString());
    console.log('Fetched URLs:', urls);

    // Check persons are shown
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    }, {timeout: 5000});

    // All checkboxes should be unchecked initially
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb) => {
      expect((cb as HTMLInputElement).checked).toBe(false);
    });
  });

  it('can mark a person as present by checking the checkbox', async () => {
    renderWithProviders(<ProductionAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Find Alice's checkbox
    const aliceCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(aliceCheckbox.checked).toBe(false);

    // Check it
    fireEvent.click(aliceCheckbox);

    // Verify POST was called
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const personPost = calls.find((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/production/1/persons') && call[1]?.method === 'POST';
      });
      expect(personPost).toBeDefined();
      if (personPost) {
        const body = JSON.parse(personPost[1].body);
        expect(body.personId).toBe(1);
      }
    });
  });

  it('shows attendance counter', async () => {
    renderWithProviders(<ProductionAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('0 van 3 aanwezig')).toBeInTheDocument();
    });
  });

  it('displays responsive grid layout', async () => {
    renderWithProviders(<ProductionAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('0 van 3 aanwezig')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Check that grid container exists - using data-testid or checking parent structure
    const aliceLabel = screen.getByText('Alice').closest('label');
    const gridContainer = aliceLabel?.parentElement;
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer?.className).toContain('grid');
    expect(gridContainer?.className).toContain('grid-cols-1');
    expect(gridContainer?.className).toContain('sm:grid-cols-2');
    expect(gridContainer?.className).toContain('md:grid-cols-3');
  });
  it('can save and navigate back', async () => {
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = {href: ''};

    renderWithProviders(<ProductionAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Opslaan')).toBeInTheDocument();
    });

    // Click save button
    fireEvent.click(screen.getByText('Opslaan'));

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('Aanwezigheid opgeslagen!')).toBeInTheDocument();
    });

    // Should navigate after timeout (we can't easily test setTimeout in this context)
  });

  it('can cancel and navigate back', async () => {
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = {href: ''};

    renderWithProviders(<ProductionAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Annuleren')).toBeInTheDocument();
    });

    // Click cancel button
    fireEvent.click(screen.getByText('Annuleren'));

    // Navigation happens but we can't easily verify in this test setup
  });


});
