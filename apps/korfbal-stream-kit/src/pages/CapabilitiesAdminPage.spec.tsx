import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import CapabilitiesAdminPage from './CapabilitiesAdminPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('CapabilitiesAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url, 'http://localhost');

      // List capabilities
      if (u.pathname.endsWith('/api/capabilities') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 1, code: 'COACH', functionName: 'Coach', nameMale: 'Coach', nameFemale: 'Coach', vMixTitle: false },
          { id: 2, code: 'SPELER', functionName: 'Speler', nameMale: 'Speler', nameFemale: 'Speelster', vMixTitle: true },
        ], page: 1, limit: 100, total: 2, pages: 1 }) } as any;
      }
      // Create
      if (u.pathname.endsWith('/api/capabilities') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 3, code: 'ANALIST', nameMale: 'Analist', nameFemale: 'Analist' }) } as any;
      }
      // Update
      if (u.pathname.match(/\/api\/capabilities\/(\d+)/) && init?.method === 'PUT') {
        return { ok: true, json: async () => ({ id: 1, code: 'COACH', nameMale: 'Coach NL', nameFemale: 'Coach NL' }) } as any;
      }
      // Delete
      if (u.pathname.match(/\/api\/capabilities\/(\d+)/) && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('renders list and supports create/edit/delete flows', async () => {
    renderWithProviders(<CapabilitiesAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Table shows existing capabilities
    expect(screen.getAllByText('COACH').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SPELER').length).toBeGreaterThan(0);

    // Create new capability
    fireEvent.click(screen.getByText(/Nieuw/));
    const codeInput = screen.getByLabelText('Capability code') as HTMLInputElement;
    // Autofocus on first field (code)
    expect(codeInput).toHaveFocus();
    const funcInput = screen.getByLabelText('Capability function name') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: 'ANALIST' } });
    fireEvent.change(funcInput, { target: { value: 'Analist' } });
    const maleInput = screen.getByLabelText('Capability name male') as HTMLInputElement;
    fireEvent.change(maleInput, { target: { value: 'Analist' } });
    const femaleInput = screen.getByLabelText('Capability name female') as HTMLInputElement;
    fireEvent.change(femaleInput, { target: { value: 'Analist' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/capabilities'), expect.objectContaining({ method: 'POST' })));

    // Edit first row
    const editBtns = screen.getAllByLabelText('Edit capability');
    fireEvent.click(editBtns[0]);
    const maleEdit = screen.getByLabelText('Capability name male') as HTMLInputElement;
    fireEvent.change(maleEdit, { target: { value: 'Coach NL' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/capabilities/1'), expect.objectContaining({ method: 'PUT' })));

    // Delete second row
    const delBtns = screen.getAllByLabelText('Delete capability');
    fireEvent.click(delBtns[1]);
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((c: any[]) => ({ url: typeof c[0] === 'string' ? c[0] : c[0].toString(), init: c[1] }));
      expect(calls.some((c: any) => c.url.match(/\/api\/capabilities\/\d+$/) && c.init?.method === 'DELETE')).toBe(true);
    });
  });

  it('shows an error notification when create capability fails', async () => {
    // First render
    renderWithProviders(<CapabilitiesAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Next POST responds with server error JSON
    (global.fetch as any).mockImplementationOnce(async (input: any, init?: any) => {
      return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ error: 'DB constraint' }) } as any;
    });

    fireEvent.click(screen.getByText(/Nieuw/));
    const codeInput = screen.getByLabelText('Capability code') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent || '').toMatch(/DB constraint|Opslaan mislukt/);
    });
  });
});
