import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import SponsorsPage from './SponsorsPage';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import * as api from '../lib/api';
import * as download from '../lib/download';

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
    vi.spyOn(api, 'fetchSponsors').mockResolvedValue(mockData);
    vi.spyOn(api, 'uploadSponsorsExcel').mockResolvedValue({ ok: true, created: 2, updated: 0 });
    vi.spyOn(api, 'createSponsor').mockImplementation(async (input) => ({ ...input, id: 3, logoUrl: '', createdAt: new Date().toISOString() }));
    vi.spyOn(api, 'updateSponsor').mockImplementation(async (id, input) => ({ ...mockData.items[0], ...input }));
    vi.spyOn(api, 'uploadSponsorLogo').mockImplementation(async (id, file) => ({ ...mockData.items[0], logoUrl: file.name }));
    vi.spyOn(api, 'downloadAllSponsorLogos').mockResolvedValue();
    vi.spyOn(download, 'downloadFile').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads a logo when submitting the form with a file', async () => {
    renderWithProviders(<SponsorsPage />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    // Open the modal to create a new sponsor
    fireEvent.click(screen.getByText('Nieuwe sponsor'));
    await screen.findByText('Nieuwe sponsor');

    // Fill the form
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Test Sponsor' } });
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: 'https://test.com' } });

    // Attach a file
    const file = new File(['logo'], 'test-logo.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText(/Logo uploaden/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Submit
    fireEvent.click(screen.getByText('Opslaan'));

    // Verify mocks were called
    await waitFor(() => {
      expect(api.createSponsor).toHaveBeenCalled();
      expect(api.uploadSponsorLogo).toHaveBeenCalledWith(expect.any(Number), file);
    });
  });

  it('calls the download all logos API when the button is clicked', async () => {
    renderWithProviders(<SponsorsPage />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    const downloadButton = screen.getByTitle('Download alle logos');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(api.downloadAllSponsorLogos).toHaveBeenCalled();
    });
  });
});
