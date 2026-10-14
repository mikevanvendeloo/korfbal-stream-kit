import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import ConnectionSettingsTab from './ConnectionSettingsTab';
import {vi} from 'vitest';

// Mock API calls
global.fetch = vi.fn();

const createFetchResponse = (data: any) => ({
  ok: true,
  json: () => new Promise(resolve => resolve(data)),
});

describe('ConnectionSettingsTab', () => {
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.resetAllMocks();
    (fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/settings/scoreboard-config')) {
        return Promise.resolve(createFetchResponse({ scoreboardUrl: 'http://score.test', shotclockUrl: 'http://shot.test' }));
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ConnectionSettingsTab />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('loads and displays existing settings', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('link', {name: /vMix-koppeling/})).toHaveAttribute('href', '/admin/stamgegevens/vmix-koppeling');
      expect(screen.getByLabelText(/scoreboard base url/i)).toHaveValue('http://score.test');
      expect(screen.getByLabelText(/shotclock base url/i)).toHaveValue('http://shot.test');
    });
  });

  it('saves the settings when the form is submitted', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole('button', { name: /instellingen opslaan/i })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/scoreboard base url/i), { target: { value: 'http://new-score.url' } });
    fireEvent.click(screen.getByRole('button', { name: /instellingen opslaan/i }));

    await waitFor(() => {
      const call = (fetch as any).mock.calls.find((c: any) =>
        c[0].toString().includes('/api/settings/scoreboard-config') && c[1]?.method === 'PUT'
      );
      if (!call) throw new Error('scoreboard PUT call not found yet');
      expect(JSON.parse(call[1].body)).toEqual({ scoreboardUrl: 'http://new-score.url', shotclockUrl: 'http://shot.test' });
      expect(screen.getByText(/verbindingsinstellingen opgeslagen/i)).toBeInTheDocument();
    });
    // vMix is no longer saved here
    expect((fetch as any).mock.calls.some((c: any) => c[0].toString().includes('vmix'))).toBe(false);
  });
});
