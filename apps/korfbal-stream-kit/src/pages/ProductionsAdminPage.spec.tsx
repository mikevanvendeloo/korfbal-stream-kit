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
      // Persons and capabilities for assignments (handle various URL formats including port 3000)
      if (u.pathname.includes('/api/production/persons') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [ { id: 1, name: 'Alice', gender: 'female', createdAt: new Date().toISOString() } ], page: 1, limit: 100, total: 1, pages: 1 }) } as any;
      }
      if (u.pathname.includes('/api/production/skills') && (!init || init.method === 'GET')) {
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

  it('can add a person with a role to a production', async () => {
    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Click "Crew" button to open crew management panel
    const crewButtons = screen.getAllByText('Crew');
    fireEvent.click(crewButtons[0]);

    // Wait for assignment panel to appear with options loaded
    await waitFor(() => {
      const personSel = screen.getByLabelText('assignment-person') as HTMLSelectElement;
      expect(personSel.options.length).toBeGreaterThan(1);
    });

    // Select person and role
    const personSel = screen.getByLabelText('assignment-person') as HTMLSelectElement;
    const roleSel = screen.getByLabelText('assignment-role') as HTMLSelectElement;

    fireEvent.change(personSel, { target: { value: '1' } });
    fireEvent.change(roleSel, { target: { value: '10' } });

    // Add the assignment
    fireEvent.click(screen.getByLabelText('add-assignment'));

    // Verify POST call was made with correct data
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const assignmentPost = calls.find((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/production/1/assignments') && call[1]?.method === 'POST';
      });
      expect(assignmentPost).toBeDefined();
      if (assignmentPost) {
        const body = JSON.parse(assignmentPost[1].body);
        expect(body.personId).toBe(1);
        expect(body.skillId).toBe(10);
      }
    }, { timeout: 3000 });
  });

  it('can add the same person with multiple roles to a production', async () => {
    // Override fetch mock for this test to return existing assignment
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
        ], filters: [] }) } as any;
      }
      // Persons
      if (u.pathname.includes('/api/production/persons') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [ { id: 1, name: 'Alice', gender: 'female', createdAt: new Date().toISOString() } ], page: 1, limit: 100, total: 1, pages: 1 }) } as any;
      }
      // Skills
      if (u.pathname.includes('/api/production/skills') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 10, code: 'COACH', nameMale: 'Coach', nameFemale: 'Coach' },
          { id: 11, code: 'COMMENTATOR', nameMale: 'Commentator', nameFemale: 'Commentatrice' }
        ], page: 1, limit: 100, total: 2, pages: 1 }) } as any;
      }
      // Assignments list - return existing assignment with COACH role
      if (u.pathname.match(/\/api\/production\/1\/assignments$/) && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ([
          { id: 200, personId: 1, skillId: 10, person: { id: 1, name: 'Alice', gender: 'female' }, skill: { id: 10, code: 'COACH', nameMale: 'Coach', nameFemale: 'Coach' } }
        ]) } as any;
      }
      // Add assignment - return new assignment with the requested role
      if (u.pathname.match(/\/api\/production\/1\/assignments$/) && init?.method === 'POST') {
        const body = JSON.parse(init.body);
        return { ok: true, json: async () => ({
          id: 201,
          personId: body.personId,
          skillId: body.skillId,
          person: { id: 1, name: 'Alice', gender: 'female' },
          skill: { id: body.skillId, code: body.skillId === 11 ? 'COMMENTATOR' : 'COACH', nameMale: body.skillId === 11 ? 'Commentator' : 'Coach', nameFemale: body.skillId === 11 ? 'Commentatrice' : 'Coach' }
        }) } as any;
      }

      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(<ProductionsAdminPage />);

    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Click "Crew" button
    const crewButtons = screen.getAllByText('Crew');
    fireEvent.click(crewButtons[0]);

    // Wait for existing assignment to be displayed (Alice - COACH)
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
      expect(screen.getByText('[COACH]')).toBeInTheDocument();
    });

    // Now add a second role (COMMENTATOR) for the same person
    const personSel = screen.getByLabelText('assignment-person') as HTMLSelectElement;
    const roleSel = screen.getByLabelText('assignment-role') as HTMLSelectElement;

    fireEvent.change(personSel, { target: { value: '1' } });
    fireEvent.change(roleSel, { target: { value: '11' } }); // COMMENTATOR

    fireEvent.click(screen.getByLabelText('add-assignment'));

    // Verify POST call was made with COMMENTATOR role
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const commentatorPost = calls.find((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        if (url.includes('/production/1/assignments') && call[1]?.method === 'POST') {
          const body = JSON.parse(call[1].body);
          return body.skillId === 11;
        }
        return false;
      });
      expect(commentatorPost).toBeDefined();
    }, { timeout: 3000 });

    // Verify both assignments are shown (or at least the delete button appears)
    await waitFor(() => {
      const delBtns = screen.queryAllByLabelText('Delete assignment');
      expect(delBtns.length).toBeGreaterThanOrEqual(1);
    });
  });
});
