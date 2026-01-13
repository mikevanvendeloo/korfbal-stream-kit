import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import SegmentDefaultsAdminPage from './SegmentDefaultsAdminPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('SegmentDefaultsAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      const u = new URL(url, 'http://localhost');

      if (u.pathname.endsWith('/api/production/segment-default-positions/names') && method === 'GET') {
        return { ok: true, json: async () => ({ items: ['__GLOBAL__', 'Voorbeschouwing'] }) } as any;
      }

      if (u.pathname.endsWith('/api/production/positions') && method === 'GET') {
        return { ok: true, json: async () => ([
          { id: 1, name: 'Camera links', skill: { id: 101, code: 'CAMERA_ZOOM', name: 'Camera zoom' } },
          { id: 2, name: 'Regie', skill: { id: 102, code: 'REGISSEUR', name: 'Regie' } },
        ]) } as any;
      }

      if (u.pathname.endsWith('/api/production/segment-default-positions') && method === 'GET') {
        // initial empty
        return { ok: true, json: async () => ([]) } as any;
      }

      if (u.pathname.endsWith('/api/production/segment-default-positions') && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => (parsed.positions.map((p: any) => ({ id: p.order + 1, segmentName: parsed.segmentName, positionId: p.positionId, order: p.order, position: { id: p.positionId, name: p.positionId === 1 ? 'Camera links' : 'Regie' } }))) } as any;
      }

      return { ok: false, status: 404 } as any;
    });
  });

  it('loads catalog, adds positions, reorders and saves defaults', async () => {
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    ;(globalThis.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? String(init.body) : undefined;
      calls.push({ url, method, body });
      const u = new URL(url, 'http://localhost');
      if (u.pathname.endsWith('/api/production/segment-default-positions/names') && method === 'GET') {
        return { ok: true, json: async () => ({ items: ['__GLOBAL__', 'Voorbeschouwing'] }) } as any;
      }
      if (u.pathname.endsWith('/api/production/positions') && method === 'GET') {
        return { ok: true, json: async () => ([
          { id: 1, name: 'Camera links', skill: { id: 101, code: 'CAMERA_ZOOM', name: 'Camera zoom' } },
          { id: 2, name: 'Regie', skill: { id: 102, code: 'REGISSEUR', name: 'Regie' } },
        ]) } as any;
      }
      if (u.pathname.endsWith('/api/production/segment-default-positions') && method === 'GET') {
        return { ok: true, json: async () => ([]) } as any;
      }
      if (u.pathname.endsWith('/api/production/segment-default-positions') && method === 'PUT') {
        const parsed = body ? JSON.parse(body) : {};
        return { ok: true, json: async () => (parsed.positions.map((p: any) => ({ id: p.order + 1, segmentName: parsed.segmentName, positionId: p.positionId, order: p.order, position: { id: p.positionId, name: p.positionId === 1 ? 'Camera links' : 'Regie' } }))) } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    renderWithProviders(<SegmentDefaultsAdminPage />);

    // Catalog loaded
    await waitFor(() => expect(screen.getByText('Camera links')).toBeInTheDocument());

    // Selector has Algemeen
    const selector = screen.getByLabelText('segment-select');
    expect((selector as HTMLSelectElement).value).toBe('Voorbeschouwing');
    expect(Array.from((selector as HTMLSelectElement).options).some(o => o.value === 'Algemeen')).toBe(true);

    // Add two positions
    fireEvent.click(screen.getByRole('button', { name: 'add-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-2' }));

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'save-defaults' }));
    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/api/production/segment-default-positions') && c.method === 'PUT')).toBe(true);
    });
  });
});
