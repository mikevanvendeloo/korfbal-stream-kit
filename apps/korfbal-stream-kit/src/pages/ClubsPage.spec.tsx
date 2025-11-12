import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import ClubsPage from './ClubsPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('ClubsPage', () => {
  const clubs = [
    { id: 1, name: 'LDODK', shortName: 'LDODK', slug: 'ldodk', logoUrl: 'clubs/ldodk.png' },
    { id: 2, name: 'Fortuna', shortName: 'Fortuna', slug: 'fortuna', logoUrl: 'clubs/fortuna.png' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      const method = (init?.method || 'GET').toUpperCase();
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/clubs' && method === 'GET') {
        return { ok: true, json: async () => clubs } as any;
      }
      if (u.pathname === '/api/clubs/ldodk/players' && method === 'GET') {
        return { ok: true, json: async () => [] } as any;
      }
      if (u.pathname === '/api/clubs/fortuna/players' && method === 'GET') {
        return { ok: true, json: async () => [] } as any;
      }
      if (u.pathname === '/api/clubs/ldodk' && method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({ ok: true }) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('shows selected club name and logo', async () => {
    renderWithProviders(<ClubsPage />);
    // wait for clubs to load
    await waitFor(() => expect(screen.queryByText('Kies club')).toBeInTheDocument());
    // Header should show LDODK
    expect(await screen.findByText('LDODK')).toBeInTheDocument();
    // Logo image should be present with alt
    const img = await screen.findByAltText('LDODK logo');
    expect((img as HTMLImageElement).getAttribute('src') || '').toContain('/uploads/clubs/ldodk.png');
  });

  it('can delete a club and switch selection to next', async () => {
    // auto-confirm window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<ClubsPage />);
    await waitFor(() => expect(screen.queryByText('Kies club')).toBeInTheDocument());

    // Delete current (LDODK)
    const delBtn = await screen.findByRole('button', { name: 'Verwijder club' });
    fireEvent.click(delBtn);

    // After delete, header should eventually show the next club (Fortuna)
    await waitFor(async () => {
      expect(await screen.findByText('Fortuna')).toBeInTheDocument();
    });
  });
});
