import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
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
      if (url.includes('/api/settings/vmix-url')) {
        return Promise.resolve(createFetchResponse({ vmixWebUrl: 'http://vmix.test:8088' }));
      }
      if (url.includes('/api/settings/scoreboard-config')) {
        return Promise.resolve(createFetchResponse({ scoreboardUrl: 'http://score.test', shotclockUrl: 'http://shot.test' }));
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ConnectionSettingsTab />
      </QueryClientProvider>
    );

  it('loads and displays existing settings', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/vmix web controller url/i)).toHaveValue('http://vmix.test:8088');
      expect(screen.getByLabelText(/scoreboard base url/i)).toHaveValue('http://score.test');
      expect(screen.getByLabelText(/shotclock base url/i)).toHaveValue('http://shot.test');
    });
  });

  it('saves the settings when the form is submitted', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole('button', { name: /instellingen opslaan/i })).toBeInTheDocument());

    const vmixInput = screen.getByLabelText(/vmix web controller url/i);
    fireEvent.change(vmixInput, { target: { value: 'http://new-vmix.url' } });

    const saveButton = screen.getByRole('button', { name: /instellingen opslaan/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const vmixCall = (fetch as any).mock.calls.find((call: any) =>
        call[0].toString().includes('/api/settings/vmix-url') && call[1]?.method === 'PUT'
      );
      if (!vmixCall) throw new Error('vmix PUT call not found yet');
      const vmixFetch = vmixCall[1];
      expect(JSON.parse(vmixFetch.body)).toEqual({ vmixWebUrl: 'http://new-vmix.url' });
      expect(screen.getByText(/verbindingsinstellingen opgeslagen/i)).toBeInTheDocument();
    });
  });
});
