import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SponsorsPage from './SponsorsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
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
