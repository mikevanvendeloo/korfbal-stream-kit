import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import VmixTemplatesPage from './VmixTemplatesPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

const baseList = [
  {
    id: 1,
    productionId: null,
    name: 'Presentatie + analist',
    order: 1,
    enabled: true,
    parts: [
      { sourceType: 'PRESENTATION_AND_ANALIST', teamSide: 'NONE', limit: null },
    ],
  },
];

describe('VmixTemplatesPage CRUD', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/admin/vmix/title-templates') && method === 'GET') {
        return { ok: true, json: async () => baseList } as any;
      }
      if (u.pathname.endsWith('/api/admin/vmix/title-templates') && method === 'POST') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 99, order: 99, productionId: null, enabled: true, parts: [], ...parsed }) } as any;
      }
      if (u.pathname.match(/\/api\/admin\/vmix\/title-templates\/(\d+)/) && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: Number(u.pathname.split('/').pop()), order: 1, productionId: null, enabled: true, parts: [], name: parsed.name || 'Updated' }) } as any;
      }
      if (u.pathname.match(/\/api\/admin\/vmix\/title-templates\/(\d+)/) && method === 'DELETE') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      if (u.pathname.endsWith('/api/admin/vmix/title-templates:reorder') && method === 'PATCH') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('can create, update and delete a title-template', async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    (globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      calls.push({ url, method, body });
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/admin/vmix/title-templates') && method === 'GET') {
        return { ok: true, json: async () => baseList } as any;
      }
      if (u.pathname.endsWith('/api/admin/vmix/title-templates') && method === 'POST') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 100, order: 100, productionId: null, enabled: !!parsed.enabled, parts: parsed.parts || [], name: parsed.name }) } as any;
      }
      if (u.pathname.endsWith('/api/admin/vmix/title-templates/1') && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ ...baseList[0], name: parsed.name || 'Gewijzigd' }) } as any;
      }
      if (u.pathname.endsWith('/api/admin/vmix/title-templates/1') && method === 'DELETE') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(<VmixTemplatesPage />);

    // wacht op initial load
    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Create
    fireEvent.click(screen.getByRole('button', { name: 'Nieuwe template' }));
    const nameInput = screen.getByLabelText('Naam', { selector: 'input' });
    fireEvent.change(nameInput, { target: { value: 'Nieuwe template' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/admin/vmix/title-templates') && c.method === 'POST')).toBe(true);
    });

    // Update (first row)
    fireEvent.click(screen.getAllByRole('button', { name: 'Bewerk' })[0]);
    const editName = screen.getByLabelText('Naam', { selector: 'input' });
    fireEvent.change(editName, { target: { value: 'Gewijzigde naam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/admin/vmix/title-templates/1') && c.method === 'PUT')).toBe(true);
    });

    // Delete
    fireEvent.click(screen.getAllByRole('button', { name: 'Verwijder' })[0]);
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/admin/vmix/title-templates/1') && c.method === 'DELETE')).toBe(true);
    });
  });
});
