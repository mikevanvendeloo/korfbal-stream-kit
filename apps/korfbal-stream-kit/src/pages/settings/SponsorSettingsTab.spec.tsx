import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SponsorSettingsTab from './SponsorSettingsTab';
import { vi } from 'vitest';
import { ALL_SPONSOR_TYPES } from '../SponsorsPage';

// Mock API calls
global.fetch = vi.fn();

const createFetchResponse = (data: any) => ({
  ok: true,
  json: () => new Promise(resolve => resolve(data)),
});

describe('SponsorSettingsTab', () => {
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.resetAllMocks();
    (fetch as any).mockResolvedValue(
      createFetchResponse({
        namesTypes: ['premium', 'goud'],
        rowsTypes: ['zilver'],
        slidesTypes: ['brons'],
      })
    );
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <SponsorSettingsTab />
      </QueryClientProvider>
    );

  it('loads and displays existing settings', async () => {
    renderComponent();
    await waitFor(() => {
      const premiumCheckboxes = screen.getAllByLabelText('premium');
      const goudCheckboxes = screen.getAllByLabelText('goud');
      const zilverCheckboxes = screen.getAllByLabelText('zilver');
      const bronsCheckboxes = screen.getAllByLabelText('brons');

      // Names section: premium and goud should be checked
      expect(premiumCheckboxes[0]).toBeChecked();
      expect(goudCheckboxes[0]).toBeChecked();

      // Rows section: zilver should be checked
      expect(zilverCheckboxes[1]).toBeChecked();

      // Slides section: brons should be checked
      expect(bronsCheckboxes[2]).toBeChecked();
    });
  });

  it('saves the settings when a checkbox is changed and form is submitted', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByRole('button', { name: /instellingen opslaan/i })).toBeInTheDocument());

    // Uncheck 'goud' from the 'Names' section
    const goudCheckbox = screen.getAllByLabelText('goud')[0];
    fireEvent.click(goudCheckbox);

    const saveButton = screen.getByRole('button', { name: /instellingen opslaan/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/settings/sponsor-config', expect.any(Object));
      const fetchOptions = (fetch as any).mock.calls[1][1];
      expect(JSON.parse(fetchOptions.body)).toEqual({
        namesTypes: ['premium'],
        rowsTypes: ['zilver'],
        slidesTypes: ['brons'],
      });
      expect(screen.getByText(/sponsorinstellingen opgeslagen/i)).toBeInTheDocument();
    });
  });
});
