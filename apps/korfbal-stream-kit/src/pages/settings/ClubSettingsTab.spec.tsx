import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import ClubSettingsTab from './ClubSettingsTab';
import {vi} from 'vitest';

// Mock API calls
global.fetch = vi.fn();

const createFetchResponse = (data: any) => ({
  ok: true,
  json: () => new Promise(resolve => resolve(data)),
});

describe('ClubSettingsTab', () => {
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.resetAllMocks();
    (fetch as any).mockImplementation((url: any) => {
      const urlString = url.toString();
      if (urlString.includes('/api/settings/club-config')) {
        return Promise.resolve(createFetchResponse({ ownClubId: 1, productionTeamNames: ['Team A'] }));
      }
      if (urlString.includes('/api/clubs') && !urlString.includes('teams')) {
        return Promise.resolve(createFetchResponse([{ id: 1, name: 'My Club' }]));
      }
      if (urlString.includes('/api/clubs/1/teams')) {
        return Promise.resolve(createFetchResponse([{ name: 'Team A' }, { name: 'Team B' }]));
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ClubSettingsTab />
      </QueryClientProvider>
    );

  it('loads and displays existing settings', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/eigen club/i)).toHaveValue('1');
      expect(screen.getByLabelText(/team a/i)).toBeChecked();
      expect(screen.getByLabelText(/team b/i)).not.toBeChecked();
    });
  });

  it('saves the settings when the form is submitted', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole('button', { name: /instellingen opslaan/i })).toBeInTheDocument());

    const saveButton = screen.getByRole('button', { name: /instellingen opslaan/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const fetchCall = (fetch as any).mock.calls.find((call: any) =>
        call[0].toString().includes('/api/settings/club-config') && call[1]?.method === 'PUT'
      );
      if (!fetchCall) throw new Error('PUT call not found yet');
      const fetchOptions = fetchCall[1];
      expect(JSON.parse(fetchOptions.body)).toEqual({ ownClubId: 1, productionTeamNames: ['Team A'] });
      expect(screen.getByText(/clubinstellingen opgeslagen/i)).toBeInTheDocument();
    });
  });
});
