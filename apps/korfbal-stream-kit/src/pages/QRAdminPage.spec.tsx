import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import QRAdminPage from './QRAdminPage';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../theme/ThemeProvider';
import {document} from "postcss";

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('QRAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders QR for a valid URL and allows SVG download', async () => {
    // JSDOM lacks URL.createObjectURL; stub it for the download flow
    // @ts-expect-error
    if (!global.URL.createObjectURL) {
      // @ts-expect-error
      global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    }
    // @ts-expect-error
    if (!global.URL.revokeObjectURL) {
      // @ts-expect-error
      global.URL.revokeObjectURL = vi.fn(() => { /* empty */ });
    }
    renderWithProviders(<QRAdminPage />);

    const urlInput = screen.getByLabelText('URL input') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

    // An SVG should be present when valid
    const svgEl = await screen.findByRole('img', { hidden: true }).catch(() => null);
    // react-qr-code does not set role, fallback to querying svg element
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();

    // Mock anchor click
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => ({} as any));
    const btn = screen.getByLabelText('download-svg');
    fireEvent.click(btn);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('switches to email mode and validates input', async () => {
    renderWithProviders(<QRAdminPage />);

    const typeSelect = screen.getByLabelText('Type') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'email' } });

    const emailInput = screen.getByLabelText('Email input') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    // SVG should appear for valid email (mailto:)
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
