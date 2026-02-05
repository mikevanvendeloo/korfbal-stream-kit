import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import PersonsAdminPage from './PersonsAdminPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

type Person = { id: number; name: string; gender: 'male' | 'female'; createdAt: string };
const persons: Person[] = [
  { id: 1, name: 'Alice', gender: 'female', createdAt: new Date().toISOString() },
  { id: 2, name: 'Bob', gender: 'male', createdAt: new Date().toISOString() },
];

const paginated = { items: persons, page: 1, limit: 50, total: 2, pages: 1 };

describe('PersonsAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url, 'http://localhost');
      // Persons list
      if (u.pathname.endsWith('/api/production/persons') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => paginated } as any;
      }
      // Create person
      if (u.pathname.endsWith('/api/production/persons') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 3, name: 'Cara', gender: 'female', createdAt: new Date().toISOString() }) } as any;
      }
      // Update person
      if (u.pathname.match(/\/api\/production\/persons\/(\d+)/) && init?.method === 'PUT') {
        return { ok: true, json: async () => ({ ...persons[0], name: 'Alice Doe' }) } as any;
      }
      // Delete person
      if (u.pathname.match(/\/api\/production\/persons\/(\d+)/) && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) } as any;
      }
      // Skills catalog (paginated)
      if (u.pathname.endsWith('/api/production/skills') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 10, code: 'COACH', name: 'Coach', nameMale: 'Coach', nameFemale: 'Coach' },
          { id: 11, code: 'COMMENTATOR', name: 'Commentaar', nameMale: 'Commentator', nameFemale: 'Commentatrice' },
        ], page: 1, limit: 100, total: 2, pages: 1 }) } as any;
      }
      // Skills list for person 1
      if (u.pathname.endsWith('/api/production/persons/1/skills') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ([
          { personId: 1, skillId: 10, skill: { id: 10, code: 'COACH', nameMale: 'Coach', nameFemale: 'Coach' } },
        ]) } as any;
      }
      // Add skill for any person
      if (u.pathname.match(/\/api\/production\/(?:persons)\/(\d+)\/skills$/) && init?.method === 'POST') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      // Remove skill
      if (u.pathname.match(/\/api\/production\/persons\/(\d+)\/skills\/(\d+)/) && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('renders list and allows creating a person', async () => {
    renderWithProviders(<PersonsAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden...')).not.toBeInTheDocument());

    // Persons visible
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);

    // Create new
    fireEvent.click(screen.getByText('Nieuw persoon'));
    const nameInput = screen.getByLabelText('Naam') as HTMLInputElement;
    // Autofocus on first field in the form
    expect(nameInput).toHaveFocus();
    fireEvent.change(nameInput, { target: { value: 'Cara' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const hasPersonPost = calls.some((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/api/production/persons') && call[1]?.method === 'POST';
      });
      expect(hasPersonPost).toBe(true);
    });
  });

  it('filters by gender', async () => {
    renderWithProviders(<PersonsAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden...')).not.toBeInTheDocument());

    const select = screen.getByLabelText('Geslacht') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'female' } });

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((c: any[]) => (typeof c[0] === 'string' ? c[0] : c[0].toString()));
      expect(calls.some((u: string) => u.includes('gender=female'))).toBe(true);
    });
  });

  it('manages skills: open modal focuses first field, add, edit and remove', async () => {
    renderWithProviders(<PersonsAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden...')).not.toBeInTheDocument());

    // Open skills for first person (Alice, id=1)
    const manageBtns = screen.getAllByLabelText('Manage skills');
    expect(manageBtns.length).toBeGreaterThan(0);
    fireEvent.click(manageBtns[0]);

    // Wait for modal
    await waitFor(() => expect(screen.getByText('Skills')).toBeInTheDocument());

    // First field (add select) should have focus
    const addSel = screen.getByLabelText('Add skill select') as HTMLSelectElement;
    expect(addSel).toHaveFocus();

    // Add skill via top select + add button
    fireEvent.change(addSel, { target: { value: '11' } });
    const addBtn = screen.getByLabelText('Add skill');
    fireEvent.click(addBtn);
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const hasSkillPost = calls.some((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/api/production/persons/1/skills') && call[1]?.method === 'POST';
      });
      expect(hasSkillPost).toBe(true);
    });

    // Edit existing skill: click edit, change to 11
    const editBtns = screen.getAllByLabelText('Edit skill');
    expect(editBtns.length).toBeGreaterThan(0);
    fireEvent.click(editBtns[0]);

    const editSel = screen.getByLabelText('Edit skill select') as HTMLSelectElement;
    fireEvent.change(editSel, { target: { value: '11' } });

    // Expect a POST then DELETE calls happened for replace
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((c: any[]) => ({ url: typeof c[0] === 'string' ? c[0] : c[0].toString(), init: c[1] }));
      const postReplace = calls.some((c: any) => c.url.includes('/api/production/persons/1/skills') && c.init?.method === 'POST');
      const delReplace = calls.some((c: any) => c.url.match(/\/api\/production\/persons\/1\/skills\/10$/) && c.init?.method === 'DELETE');
      expect(postReplace && delReplace).toBe(true);
    });

    // Remove skill
    const rmBtns = screen.getAllByLabelText('Remove skill');
    fireEvent.click(rmBtns[0]);
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((c: any[]) => ({ url: typeof c[0] === 'string' ? c[0] : c[0].toString(), init: c[1] }));
      expect(calls.some((c: any) => c.url.match(/\/api\/production\/persons\/1\/skills\/(\d+)$/) && c.init?.method === 'DELETE')).toBe(true);
    });
  });

  it('shows an error notification when create person fails with server error', async () => {
    // First call loads list
    renderWithProviders(<PersonsAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden...')).not.toBeInTheDocument());

    // Next POST will fail with server error body
    (global.fetch as any).mockImplementationOnce(async (input: any, init?: any) => {
      // re-route to default mock for GET list if needed
      return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ error: 'Database error' }) } as any;
    });

    fireEvent.click(screen.getByText('Nieuw persoon'));
    const nameInput = screen.getByLabelText('Naam') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent || '').toMatch(/Database error|Opslaan mislukt/);
    });
  });
});

describe('PersonsAdminPage (create with inline skills)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url, 'http://localhost');
      // Persons list
      if (u.pathname.endsWith('/api/production/persons') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [], page: 1, limit: 50, total: 0, pages: 1 }) } as any;
      }
      // Create person
      if (u.pathname.endsWith('/api/production/persons') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 3, name: 'Cara', gender: 'female', createdAt: new Date().toISOString() }) } as any;
      }
      // Skills catalog
      if (u.pathname.endsWith('/api/production/skills') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 10, code: 'COACH', name: 'Coach', nameMale: 'Coach', nameFemale: 'Coach' },
          { id: 11, code: 'COMMENTATOR', name: 'Commentaar', nameMale: 'Commentator', nameFemale: 'Commentatrice' },
        ], page: 1, limit: 100, total: 2, pages: 1 }) } as any;
      }
      // Add skill for person 3 after create
      if (u.pathname.endsWith('/api/production/persons/3/skills') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('stages selected skills and posts them after creating the person', async () => {
    renderWithProviders(<PersonsAdminPage />);

    // Open create modal
    const newBtn = await screen.findByText('Nieuw persoon');
    fireEvent.click(newBtn);

    // Fill name
    const nameInput = screen.getByLabelText('Naam') as HTMLInputElement;
    expect(nameInput).toHaveFocus();
    fireEvent.change(nameInput, { target: { value: 'Cara' } });

    // Select skill inline and add
    const addSels = await screen.findAllByLabelText('Add skill inline');
    const addSel = addSels.find(el => el.tagName.toLowerCase() === 'select') as HTMLSelectElement;
    fireEvent.change(addSel, { target: { value: '11' } });
    const addBtn = screen.getAllByLabelText('Add skill inline')[1] || screen.getByLabelText('Add skill inline');
    fireEvent.click(addBtn);

    // Save
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((c: any[]) => ({ url: typeof c[0] === 'string' ? c[0] : c[0].toString(), init: c[1] }));
      const created = calls.some((c: any) => c.url.endsWith('/api/production/persons') && c.init?.method === 'POST');
      const skillPost = calls.some((c: any) => c.url.match(/\/api\/production\/persons\/3\/skills$/) && c.init?.method === 'POST');
      expect(created && skillPost).toBe(true);
    });
  });
});
