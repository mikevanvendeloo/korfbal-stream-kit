import {beforeEach, describe, expect, it} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {ThemeProvider} from '../theme/ThemeProvider';
import ProductionAttendancePage from './ProductionAttendancePage';
import React from 'react';
import {mockApi} from '../test/organizations';
import type {AttendancePerson, Staffing, StaffingRole} from '../hooks/useProductions';

function renderWithProviders(ui: React.ReactNode, {route = '/admin/producties/1/beschikbaarheid'} = {}) {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/admin/producties/:id/beschikbaarheid" element={ui}/>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const person = (id: number, name: string, group: AttendancePerson['group'], present = false): AttendancePerson =>
  ({id, name, gender: 'female', group, skills: [], productionPersonId: present ? 100 + id : null});

const role = (key: string, label: string, filled: number, required: number, optional = false, extra: Partial<StaffingRole> = {}): StaffingRole => ({
  key, label, singular: key, plural: key === 'camera' ? "camera's" : `${key}s`, required, optional, skillCodes: [key.toUpperCase()],
  filled, personIds: [], unknownSkillCodes: [], met: filled >= required, ...extra,
});

/** What the API says: one camera short until "Bob" is present */
function staffingFor(present: Set<number>): Staffing {
  const cameras = present.has(2) ? 3 : 2;
  return {
    roles: [
      role('regisseur', 'Regisseur', 1, 1),
      role('camera', 'Camera', cameras, 3),
      role('commentaar', 'Commentaar', 0, 1, true),
      role('analist', 'Analist', 0, 1, true, {unknownSkillCodes: ['ANALIST']}),
    ],
    met: cameras === 3,
    shortfall: cameras === 3 ? [] : [{key: 'camera', missing: 1, singular: 'camera', plural: "camera's"}],
  };
}

describe('ProductionAttendancePage', () => {
  let present: Set<number>;
  let api: ReturnType<typeof mockApi>;

  beforeEach(() => {
    present = new Set([1]);
    const people = [
      person(1, 'Zoë', 'crew'),
      person(2, 'Bob', 'crew'),
      person(3, 'émile', 'crew'),
      person(4, 'Emma', 'crew'),
      person(5, 'anna', 'crew'),
      person(6, 'Ühlan', 'entertainment'),
      person(7, 'Charlie', 'entertainment'),
    ];
    api = mockApi(({method, path, body}) => {
      if (method === 'GET' && path === '/api/production/1') {
        return {id: 1, matchScheduleId: 100, matchSchedule: {id: 100, homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opponent'}};
      }
      if (method === 'GET' && path === '/api/production/1/attendance') {
        return {
          persons: people.map((p) => ({...p, productionPersonId: present.has(p.id) ? 100 + p.id : null})),
          staffing: staffingFor(present),
        };
      }
      if (method === 'GET' && path === '/api/production/1/persons') return [];
      if (method === 'POST' && path === '/api/production/1/persons') {
        const personId = (body as {personId: number}).personId;
        present.add(personId);
        return {id: 100 + personId, productionId: 1, personId};
      }
      const del = method === 'DELETE' && path.match(/^\/api\/production\/1\/persons\/(\d+)$/);
      if (del) {
        present.delete(Number(del[1]) - 100);
        return {};
      }
      return {};
    });
  });

  /** The checkbox in the card with this name */
  const checkboxOf = (name: string) => within(screen.getByText(name).closest('label') as HTMLElement).getByRole('checkbox') as HTMLInputElement;

  const namesIn = (group: string) =>
    within(screen.getByTestId(`attendance-group-${group}`)).getAllByRole('checkbox').map((cb) => cb.closest('label')?.textContent);

  it('renders the attendance page with production info', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    expect(await screen.findByText('Aanwezigheid crew')).toBeInTheDocument();
    expect(await screen.findByText('Fortuna/Ruitenheer 1 vs Opponent')).toBeInTheDocument();
  });

  it('shows Crew and Entertainment, each in Dutch alphabetical order ignoring case and accents', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    await screen.findByTestId('attendance-group-crew');
    expect(namesIn('crew')).toEqual(['anna', 'Bob', 'émile', 'Emma', 'Zoë']);
    expect(namesIn('entertainment')).toEqual(['Charlie', 'Ühlan']);
    expect(within(screen.getByTestId('attendance-group-crew')).getByRole('heading')).toHaveTextContent('Crew (1/5)');
    expect(within(screen.getByTestId('attendance-group-entertainment')).getByRole('heading')).toHaveTextContent('Entertainment (0/2)');
    expect(screen.getByText('1 van 7 aanwezig')).toBeInTheDocument();
  });

  it('keeps the responsive grid per group', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    const grid = (await screen.findByText('Bob')).closest('label')?.parentElement;
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(grid?.className).toContain('md:grid-cols-3');
  });

  it('shows the minimum staffing checklist with optional roles and a missing skill code', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    const summary = await screen.findByTestId('staffing-summary');
    expect(summary).toHaveTextContent('Minimale bezetting nog niet gehaald: nog 1 camera');
    expect(summary.className).toContain('amber');
    expect(screen.getByTestId('staffing-role-regisseur')).toHaveTextContent('✓Regisseur 1/1');
    expect(screen.getByTestId('staffing-role-camera')).toHaveTextContent('✗Camera 2/3');
    expect(screen.getByTestId('staffing-role-commentaar')).toHaveTextContent('–Commentaar 0/1 (optioneel)');
    expect(screen.getByTestId('staffing-role-analist')).toHaveTextContent('Vaardigheid ANALIST bestaat niet in deze organisatie');
  });

  it('updates the checklist when a person is marked present', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    await screen.findByTestId('staffing-summary');

    const bob = checkboxOf('Bob');
    expect(bob.checked).toBe(false);
    fireEvent.click(bob);

    await waitFor(() => expect(screen.getByTestId('staffing-summary')).toHaveTextContent('Minimale bezetting gehaald'));
    expect(screen.getByTestId('staffing-summary').className).toContain('green');
    expect(screen.getByTestId('staffing-role-camera')).toHaveTextContent('✓Camera 3/3');
    expect(checkboxOf('Bob').checked).toBe(true);
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({personId: 2});
  });

  it('marks a person absent with the id of their presence', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    await screen.findByTestId('staffing-summary');
    fireEvent.click(checkboxOf('Zoë'));
    await waitFor(() => expect(api.calls.some((c) => c.method === 'DELETE' && c.path === '/api/production/1/persons/101')).toBe(true));
    await waitFor(() => expect(screen.getByText('0 van 7 aanwezig')).toBeInTheDocument());
  });

  it('shows a save message', async () => {
    renderWithProviders(<ProductionAttendancePage/>);
    fireEvent.click(await screen.findByText('Opslaan'));
    expect(await screen.findByText('Aanwezigheid opgeslagen!')).toBeInTheDocument();
  });
});
