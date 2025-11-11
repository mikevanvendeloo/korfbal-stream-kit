import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import SponsorsPage from './SponsorsPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

const baseList = {
  items: [
    { id: 1, name: 'Ruitenheer', type: 'premium', websiteUrl: 'https://www.ruitenheer.nl', logoUrl: 'ruitenheer.png', createdAt: new Date().toISOString() },
  ],
  page: 1,
  limit: 100,
  total: 1,
  pages: 1,
};

describe('SponsorsPage CRUD', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => baseList } as any);
  });

  it('can add a sponsor (strips B.V. from name)', async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    (globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      calls.push({ url, method, body });
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/sponsors') && method === 'GET') {
        return { ok: true, json: async () => baseList } as any;
      }
      if (u.pathname.endsWith('/api/sponsors') && method === 'POST') {
        // Echo created sponsor
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 99, createdAt: new Date().toISOString(), logoUrl: parsed.logoUrl || 'acme.png', ...parsed }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(<SponsorsPage />);

    // wait for list
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // open new modal
    fireEvent.click(screen.getByLabelText('new-sponsor'));

    // fill in fields
    const nameInput = screen.getByLabelText('Naam', { selector: 'input' });
    const typeSelect = screen.getByLabelText('Type');
    const websiteInput = screen.getByLabelText('Website URL');

    fireEvent.change(nameInput, { target: { value: 'ACME B.V.' } });
    fireEvent.change(typeSelect, { target: { value: 'zilver' } });
    fireEvent.change(websiteInput, { target: { value: 'https://acme.test' } });

    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/api/sponsors') && c.method === 'POST')).toBe(true);
    });

    // Verify that BV was stripped in the payload
    const post = calls.find((c) => c.method === 'POST' && c.url.includes('/api/sponsors'))!;
    expect(JSON.parse(post.body!).name).toBe('ACME');
  });

  it('can edit and delete a sponsor', async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    (globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      calls.push({ url, method, body });
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/sponsors') && method === 'GET') {
        return { ok: true, json: async () => baseList } as any;
      }
      if (u.pathname.endsWith('/api/sponsors/1') && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => ({ id: 1, createdAt: new Date().toISOString(), logoUrl: 'ruitenheer.png', name: 'Ruitenheer', type: 'premium', websiteUrl: parsed.websiteUrl || 'https://www.ruitenheer.nl' }) } as any;
      }
      if (u.pathname.endsWith('/api/sponsors/1') && method === 'DELETE') {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(<SponsorsPage />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // click edit button in table (first row)
    const editBtns = screen.getAllByLabelText('Edit sponsor');
    fireEvent.click(editBtns[0]);

    // Change website and save
    const websiteInput = screen.getByLabelText('Website URL');
    fireEvent.change(websiteInput, { target: { value: 'https://nieuw.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/sponsors/1') && c.method === 'PUT')).toBe(true);
    });

    // Delete
    // Mock confirm to auto-accept
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const delBtns = screen.getAllByLabelText('Delete sponsor');
    fireEvent.click(delBtns[0]);

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/sponsors/1') && c.method === 'DELETE')).toBe(true);
    });
  });
});
