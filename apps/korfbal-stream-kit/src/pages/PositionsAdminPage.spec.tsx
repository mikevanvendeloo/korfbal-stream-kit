import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import PositionsAdminPage from './PositionsAdminPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('PositionsAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      const u = new URL(url, 'http://localhost');
      // list positions
      if (u.pathname.endsWith('/api/production/positions') && method === 'GET') {
        return { ok: true, json: async () => ([{ id: 1, name: 'Regie', skill: { id: 10, code: 'REGISSEUR', name: 'Regie' } }]) } as any;
      }
      // skills list
      if (u.pathname.endsWith('/api/skills') && method === 'GET') {
        return { ok: true, json: async () => ({ items: [ { id: 10, code: 'REGISSEUR', name: 'Regie' }, { id: 11, code: 'COMMENTAAR', name: 'Commentaar' } ], total: 2 }) } as any;
      }
      // create
      if (u.pathname.endsWith('/api/production/positions') && method === 'POST') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 99, name: parsed.name, skill: parsed.skillId ? { id: parsed.skillId, code: 'DYN', name: 'Dyn' } : null }) } as any;
      }
      // update
      if (u.pathname.match(/\/api\/production\/positions\/\d+$/) && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 1, name: parsed.name || 'Updated', skill: null }) } as any;
      }
      // delete
      if (u.pathname.match(/\/api\/production\/positions\/\d+$/) && method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('can create, update and delete positions', async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    (globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      calls.push({ url, method, body });
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/production/positions') && method === 'GET') {
        return { ok: true, json: async () => ([{ id: 1, name: 'Regie', skill: { id: 10, code: 'REGISSEUR', name: 'Regie' } }]) } as any;
      }
      if (u.pathname.endsWith('/api/skills') && method === 'GET') {
        return { ok: true, json: async () => ({ items: [ { id: 10, code: 'REGISSEUR', name: 'Regie' }, { id: 11, code: 'COMMENTAAR', name: 'Commentaar' } ], total: 2 }) } as any;
      }
      if (u.pathname.endsWith('/api/production/positions') && method === 'POST') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 99, name: parsed.name, skill: parsed.skillId ? { id: parsed.skillId, code: 'DYN', name: 'Dyn' } : null }) } as any;
      }
      if (u.pathname.match(/\/api\/production\/positions\/\d+$/) && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 1, name: parsed.name || 'Updated', skill: null }) } as any;
      }
      if (u.pathname.match(/\/api\/production\/positions\/\d+$/) && method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(<PositionsAdminPage />);

    await waitFor(() => expect(screen.getByText('Regie')).toBeInTheDocument());

    // Create
    fireEvent.click(screen.getByRole('button', { name: 'Nieuwe positie' }));
    const nameInput = screen.getByLabelText('Naam', { selector: 'input' });
    fireEvent.change(nameInput, { target: { value: 'Interview coordinator' } });
    const capSelect = screen.getByLabelText('Skill', { selector: 'select' });
    fireEvent.change(capSelect, { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/production/positions') && c.method === 'POST' && c.body?.includes('Interview coordinator'))).toBe(true);
    });

    // Update
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig' }));
    const editName = screen.getByLabelText('Naam', { selector: 'input' });
    fireEvent.change(editName, { target: { value: 'Regie (Hoofd)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(calls.some((c) => /\/api\/production\/positions\/\d+$/.test(c.url) && c.method === 'PUT')).toBe(true);
    });

    // Delete
    fireEvent.click(screen.getByRole('button', { name: 'Verwijder' }));
    await waitFor(() => {
      expect(calls.some((c) => /\/api\/production\/positions\/\d+$/.test(c.url) && c.method === 'DELETE')).toBe(true);
    });
  });
});
