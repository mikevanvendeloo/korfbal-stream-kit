import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {vi} from 'vitest';

import App from './app';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({on: vi.fn(), off: vi.fn(), disconnect: vi.fn()})),
}));

const activeSeason = {
  id: 2, startYear: 2026, name: '2026/2027',
  startDate: '2026-06-30T22:00:00.000Z', endDate: '2027-06-30T21:59:59.999Z',
  isActive: true, matchCount: 0, playerCount: 0, createdAt: '2026-07-01T00:00:00.000Z',
};

function renderApp(path = '/') {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      if (url.toString().includes('/api/seasons/active')) {
        return Promise.resolve({ok: true, json: async () => activeSeason} as Response);
      }
      return Promise.resolve({ok: false, status: 404, json: async () => ({})} as Response);
    }) as unknown as typeof fetch;
  });

  it('should render successfully', () => {
    const { baseElement } = renderApp();
    expect(baseElement).toBeTruthy();
  });

  it('shows the LIVE app on the root, without links to Beheer', () => {
    renderApp('/');
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Scoreboard'})).toHaveAttribute('href', '/scoreboard');
    expect(screen.getByRole('link', {name: 'Show Caller'})).toHaveAttribute('href', '/show-caller');
    expect(screen.queryByRole('link', {name: 'Sponsors'})).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/admin"]')).toBeNull();
  });

  it('shows the Beheer app under /admin with Sponsors link', async () => {
    renderApp('/admin');
    expect(await screen.findByText('Korfbal Streamz Kit')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sponsors' })[0]).toHaveAttribute('href', '/admin/sponsors');
  });

  it('shows the active season badge linking to settings', async () => {
    renderApp('/admin');
    const badge = await screen.findByRole('link', {name: 'Seizoen 2026/2027'});
    expect(badge).toHaveAttribute('href', '/admin/settings');
  });

  it('no longer serves Beheer pages outside /admin', () => {
    renderApp('/sponsors');
    expect(screen.getByText('Pagina niet gevonden')).toBeInTheDocument();
  });
});
