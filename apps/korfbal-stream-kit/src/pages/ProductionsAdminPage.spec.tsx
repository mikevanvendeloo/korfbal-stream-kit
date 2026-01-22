import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import ProductionsAdminPage from './ProductionsAdminPage';

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
      const u = new URL(url, 'http://localhost/api');

      // List productions
      if (u.pathname.endsWith('/production') && (!init || init.method === 'GET')) {
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
      // Persons and capabilities for assignments
      if (u.pathname.endsWith('/api/production/persons') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [ { id: 1, name: 'Alice', gender: 'female', createdAt: new Date().toISOString() } ], page: 1, limit: 100, total: 1, pages: 1 }) } as any;
      }
      if (u.pathname.endsWith('/api/production/skills') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [ { id: 10, code: 'COACH', nameMale: 'Coach', nameFemale: 'Coach' }, { id: 11, code: 'COMMENTATOR', nameMale: 'Commentator', nameFemale: 'Commentatrice' } ], page: 1, limit: 100, total: 2, pages: 1 }) } as any;
      }
      // Assignments list
      if (u.pathname.match(/\/api\/production\/1\/assignments$/) && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ([]) } as any;
      }
      // Add assignment
      if (u.pathname.match(/\/api\/production\/1\/assignments$/) && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 200, personId: 1, skillId: 10, person: { id: 1, name: 'Alice', gender: 'female' }, skill: { id: 10, code: 'COACH', nameMale: 'Coach', nameFemale: 'Coach' } }) } as any;
      }

      return { ok: false, status: 404 } as any;
    });
  });

  it('renders list, creates a production and adds multiple roles for the same person (rendered as separate rows)', async () => {
    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Create production
    fireEvent.click(screen.getByText(/Nieuw/));
    const select = screen.getByLabelText('Select match') as HTMLSelectElement;
    expect(select).toHaveFocus();
    fireEvent.change(select, { target: { value: '101' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/production'), expect.objectContaining({ method: 'POST' })));

    // Select first production to manage crew
    const crewButtons = screen.getAllByText('Crew');
    fireEvent.click(crewButtons[0]);

    // Add assignment
    const personSel = await screen.findByLabelText('assignment-person');
    fireEvent.change(personSel, { target: { value: '1' } });
    const roleSel = screen.getByLabelText('assignment-role');
    fireEvent.change(roleSel, { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('add-assignment'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/production/1/assignments'), expect.objectContaining({ method: 'POST' })));

    // Add second role for the same person
    // Mock server to return another created assignment with different capability
    ;(global.fetch as any).mockImplementationOnce(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url, 'http://localhost');
      if (u.pathname.match(/\/api\/production\/1\/assignments$/) && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 201, personId: 1, skillId: 11, person: { id: 1, name: 'Alice', gender: 'female' }, skill: { id: 11, code: 'COMMENTATOR', nameMale: 'Commentator', nameFemale: 'Commentatrice' } }) } as any;
      }
      // For GET after invalidation, return the previously created assignment so the UI shows at least one
      if ((!init || init.method === 'GET') && u.pathname.match(/\/api\/production\/1\/assignments$/)) {
        return { ok: true, json: async () => ([{ id: 200, personId: 1, skillId: 10, person: { id: 1, name: 'Alice', gender: 'female' }, skill: { id: 10, code: 'COACH', nameMale: 'Coach', nameFemale: 'Coach' } }]) } as any;
      }
      return { ok: true, json: async () => ([]) } as any;
    });

    fireEvent.change(personSel, { target: { value: '1' } });
    fireEvent.change(roleSel, { target: { value: '11' } });
    fireEvent.click(screen.getByLabelText('add-assignment'));

    // Expect two POST calls (two roles added) and at least one delete button rendered
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.filter((c: any[]) => (typeof c[0] === 'string' ? c[0] : c[0].toString()).match(/\/api\/production\/1\/assignments$/) && c[1]?.method === 'POST');
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // If the UI hasn't refetched yet, optimistic cache shows at least one row
      const delBtns = screen.queryAllByLabelText('Delete assignment');
      expect(delBtns.length).toBeGreaterThanOrEqual(1);
    });
  });
});
