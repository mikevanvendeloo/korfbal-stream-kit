import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import SponsorsPage from './SponsorsPage';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import {logger} from "nx/src/utils/logger";

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

const mockData = {
  items: [
    { id: 1, name: 'Ruitenheer', type: 'premium', websiteUrl: 'https://www.ruitenheer.nl', logoUrl: 'ruitenheer.png', createdAt: new Date().toISOString() },
    { id: 2, name: 'M-Sports', type: 'zilver', websiteUrl: 'https://www.m-sports.com', logoUrl: 'm-sports.png', createdAt: new Date().toISOString() },
  ],
  page: 1,
  limit: 100,
  total: 2,
  pages: 1,
};

describe('SponsorsPage', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as any);
  });

  it('renders sponsors in a table on desktop (md+)', async () => {
    // force desktop by setting container width; JSDOM lacks layout, but we can rely on table being in DOM
    renderWithProviders(<SponsorsPage />);

    // shows loading first
    expect(screen.getByRole('status')).toBeInTheDocument();

    // then rows appear
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Check there are at least 2 occurrences of sponsor names in the DOM (table or cards)
    expect(screen.getAllByText('Ruitenheer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('M-Sports').length).toBeGreaterThan(0);

    // Verify website links present (may appear in both card and table views)
    expect(screen.getAllByRole('link', { name: 'https://www.ruitenheer.nl' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'https://www.m-sports.com' }).length).toBeGreaterThan(0);
  });

  it('filters by type when selecting from dropdown', async () => {
    renderWithProviders(<SponsorsPage />);

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    const select = screen.getByLabelText('Filter type') as HTMLSelectElement;
    // Change mock to return only zilver after changing selection
    (globalThis.fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockData, items: mockData.items.filter((i) => i.type === 'zilver') }) });

    fireEvent.change(select, { target: { value: 'zilver' } });

    await waitFor(() => {
      expect(screen.queryAllByText('Ruitenheer').length).toBe(0);
      expect(screen.getAllByText('M-Sports').length).toBeGreaterThan(0);
    });
  });
});


it('has an Upload sponsors button that posts the Excel and refetches', async () => {
  console.log(`BASE API URL: ${import.meta.env.VITE_API_BASE_URL}`)
  const qc = new QueryClient();
  const origFetch = global.fetch as any;
  const calls: Array<{ url: string; method: string }> = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const method = init?.method || 'GET';
    calls.push({ url, method });
    const u = new URL(url, 'http://localhost/api');
    if (u.pathname.endsWith('/sponsors/upload-excel') && method === 'POST') {
      return { ok: true, json: async () => ({ ok: true, created: 2, updated: 0 }) } as any;
    }
    if (u.pathname.endsWith('/sponsors') && method === 'GET') {
      return { ok: true, json: async () => mockData } as any;
    }
    return { ok: false, status: 404 } as any;
  }) as any;
  // @ts-expect-error Test
  global.fetch = mock;

  render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <SponsorsPage />
      </QueryClientProvider>
    </ThemeProvider>
  );

  // Wait for initial load
  await waitFor(() => expect(mock).toHaveBeenCalled());

  // Click upload button -> opens file input; simulate selecting a file
  const btn = screen.getByLabelText('upload-sponsors');
  const input = screen.getByLabelText('sponsors-file') as HTMLInputElement;

  // Fire click (no effect needed in jsdom), then change file
  fireEvent.click(btn);

  const file = new File([new Uint8Array([1,2,3])], 'sponsors.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dt = {
    target: { files: [file] },
  } as any;
  fireEvent.change(input, dt);

  // Expect POST called and then GET refetch called again
  await waitFor(() => {
    expect(calls.some((c) => c.url.includes('/sponsors/upload-excel') && c.method === 'POST')).toBe(true);
  });

  // After upload, a GET for sponsors should have been made at least twice (initial + refetch)
  const getCalls = calls.filter((c) => c.url.includes('/sponsors') && c.method === 'GET');
  logger.info(getCalls);
  expect(getCalls.length).toBeGreaterThanOrEqual(2);

  global.fetch = origFetch;
});
