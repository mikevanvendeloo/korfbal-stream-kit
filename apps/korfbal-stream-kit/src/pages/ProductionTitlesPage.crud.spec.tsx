import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductionTitlesPage from './ProductionTitlesPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

const baseTitles = [
  {
    id: 1,
    productionId: 123,
    name: 'Commentaar duo',
    order: 1,
    enabled: true,
    parts: [
      { sourceType: 'COMMENTARY', teamSide: 'NONE', limit: null },
    ],
  },
];

describe('ProductionTitlesPage CRUD', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/production/123/titles') && method === 'GET') {
        return { ok: true, json: async () => baseTitles } as any;
      }
      if (u.pathname.endsWith('/api/production/123') && method === 'GET') {
        // Production header data
        return {
          ok: true,
          json: async () => ({ id: 123, matchScheduleId: 999, createdAt: new Date().toISOString(), matchSchedule: { id: 999, date: new Date().toISOString(), homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Dalto/Klaverblad' } }),
        } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles') && method === 'POST') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 99, order: 99, productionId: 123, enabled: !!parsed.enabled, parts: parsed.parts || [], name: parsed.name }) } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles/1') && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ ...baseTitles[0], name: parsed.name || 'Gewijzigd' }) } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles/1') && method === 'DELETE') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles:reorder') && method === 'PATCH') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      if (u.pathname.endsWith('/api/vmix/production/123/titles') && method === 'GET') {
        // preview endpoint
        return { ok: true, json: async () => ([{ functionName: 'LowerThird', name: 'Commentaar' }]) } as any;
      }
      if (u.pathname.endsWith('/api/admin/vmix/production/123/titles/use-default') && method === 'POST') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('can create, update and delete production titles', async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    (globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      calls.push({ url, method, body });
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/production/123/titles') && method === 'GET') {
        return { ok: true, json: async () => baseTitles } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles') && method === 'POST') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 100, order: 100, productionId: 123, enabled: !!parsed.enabled, parts: parsed.parts || [], name: parsed.name }) } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles/1') && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ ...baseTitles[0], name: parsed.name || 'Gewijzigd' }) } as any;
      }
      if (u.pathname.endsWith('/api/production/123/titles/1') && method === 'DELETE') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      if (u.pathname.endsWith('/api/vmix/production/123/titles') && method === 'GET') {
        return { ok: true, json: async () => ([{ functionName: 'LowerThird', name: 'Commentaar' }]) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(
      <MemoryRouter initialEntries={[`/admin/productions/123/titles`]}>
        <Routes>
          <Route path="/admin/productions/:id/titles" element={<ProductionTitlesPage />} />
        </Routes>
      </MemoryRouter>
    );

    // wait until titles list is rendered
    await waitFor(() => expect(screen.getByText('Commentaar duo')).toBeInTheDocument());

    // Create
    fireEvent.click(screen.getByRole('button', { name: 'Nieuwe titel' }));
    const nameInput = screen.getByLabelText('Naam', { selector: 'input' });
    fireEvent.change(nameInput, { target: { value: 'Nieuwe titel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/production/123/titles') && c.method === 'POST')).toBe(true);
    });

    // Update
    fireEvent.click(screen.getAllByRole('button', { name: 'Bewerk' })[0]);
    const editName = screen.getByLabelText('Naam', { selector: 'input' });
    fireEvent.change(editName, { target: { value: 'Gewijzigde titel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/production/123/titles/1') && c.method === 'PUT')).toBe(true);
    });

    // Delete
    fireEvent.click(screen.getAllByRole('button', { name: 'Verwijder' })[0]);
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/production/123/titles/1') && c.method === 'DELETE')).toBe(true);
    });
  });
});
