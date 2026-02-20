import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import SponsorsPage from './SponsorsPage';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';

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
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
  });

  it('renders sponsors in a table on desktop (md+)', async () => {
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

    // Verify website links are NOT present anymore (removed from table and cards)
    expect(screen.queryAllByRole('link', { name: 'https://www.ruitenheer.nl' }).length).toBe(0);
    expect(screen.queryAllByRole('link', { name: 'https://www.m-sports.com' }).length).toBe(0);
  });

  it('filters by type when selecting checkboxes', async () => {
    // Mock fetch to handle filtering
    (global.fetch as any).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      if (url.includes('type=zilver')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockData, items: mockData.items.filter((i) => i.type === 'zilver') }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockData,
      });
    });

    renderWithProviders(<SponsorsPage />);

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // Find the checkbox for 'zilver'
    const checkbox = screen.getByLabelText('zilver') as HTMLInputElement;

    fireEvent.click(checkbox);

    await waitFor(() => {
      // Ruitenheer (premium) should be gone, M-Sports (zilver) should remain
      expect(screen.queryAllByText('Ruitenheer').length).toBe(0);
      expect(screen.getAllByText('M-Sports').length).toBeGreaterThan(0);
    });
  });

  it('has an Upload sponsors button that posts the Excel and refetches', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    const calls: Array<{ url: string; method: string }> = [];

    // Custom mock for this test to track calls
    (global.fetch as any).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = init?.method || 'GET';
      calls.push({ url, method });

      if (url.includes('/sponsors/upload-excel') && method === 'POST') {
        return { ok: true, json: async () => ({ ok: true, created: 2, updated: 0 }) };
      }
      // Default GET sponsors
      return { ok: true, json: async () => mockData };
    });

    render(
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <SponsorsPage />
        </QueryClientProvider>
      </ThemeProvider>
    );

    // Wait for initial load
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // The button triggers the hidden file input
    const input = screen.getByLabelText('sponsors-file') as HTMLInputElement;

    const file = new File([new Uint8Array([1,2,3])], 'sponsors.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Simulate file selection
    fireEvent.change(input, { target: { files: [file] } });

    // Expect POST called
    await waitFor(() => {
      const postCall = calls.find((c) => c.url.includes('/sponsors/upload-excel') && c.method === 'POST');
      expect(postCall).toBeDefined();
    });

    // After upload, a GET for sponsors should have been made at least twice (initial + refetch)
    const getCalls = calls.filter((c) => c.url.includes('/sponsors') && c.method === 'GET');
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });
});
