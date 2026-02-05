import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../theme/ThemeProvider';
import SkillsAdminPage from './SkillsAdminPage';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('SkillsAdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      const u = new URL(url, 'http://localhost');

      // List skills
      if (u.pathname.endsWith('/api/skills') && (!init || init.method === 'GET')) {
        return { ok: true, json: async () => ({ items: [
          { id: 1, code: 'COACH', name: 'Coach', nameMale: 'Coach', nameFemale: 'Coach' },
          { id: 2, code: 'SPELER', name: 'Speler', nameMale: 'Speler', nameFemale: 'Speelster' },
        ], page: 1, limit: 100, total: 2, pages: 1 }) } as any;
      }
      // Create
      if (u.pathname.endsWith('/api/skills') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 3, code: 'ANALIST', name: 'Analist', nameMale: 'Analist', nameFemale: 'Analist' }) } as any;
      }
      // Update
      if (u.pathname.match(/\/api\/skills\/(\d+)/) && init?.method === 'PUT') {
        return { ok: true, json: async () => ({ id: 1, code: 'COACH', name: 'Coach', nameMale: 'Coach NL', nameFemale: 'Coach NL' }) } as any;
      }
      // Delete
      if (u.pathname.match(/\/api\/skills\/(\d+)/) && init?.method === 'DELETE') {
        return { ok: true, status: 204, json: async () => ({}) } as any;
      }
      return { ok: false, status: 404 } as any;
    });
  });

  it('renders list and supports create/edit/delete flows', async () => {
    renderWithProviders(<SkillsAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Table shows existing skills
    expect(screen.getAllByText('COACH').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SPELER').length).toBeGreaterThan(0);

    // Create new skill
    fireEvent.click(screen.getByText(/Nieuw/));
    const codeInput = screen.getByLabelText('Skill code') as HTMLInputElement;
    // Autofocus on first field (code)
    expect(codeInput).toHaveFocus();
    const nameInput = screen.getByLabelText('Skill name') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: 'ANALIST' } });
    fireEvent.change(nameInput, { target: { value: 'Analist' } });
    const maleInput = screen.getByLabelText('Skill name male') as HTMLInputElement;
    fireEvent.change(maleInput, { target: { value: 'Analist' } });
    const femaleInput = screen.getByLabelText('Skill name female') as HTMLInputElement;
    fireEvent.change(femaleInput, { target: { value: 'Analist' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const hasSkillPost = calls.some((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/api/skills') && call[1]?.method === 'POST';
      });
      expect(hasSkillPost).toBe(true);
    });

    // Edit first row
    const editBtns = screen.getAllByLabelText('Edit skill');
    fireEvent.click(editBtns[0]);
    const maleEdit = screen.getByLabelText('Skill name male') as HTMLInputElement;
    fireEvent.change(maleEdit, { target: { value: 'Coach NL' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls;
      const hasSkillPut = calls.some((call: any[]) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url.includes('/api/skills/1') && call[1]?.method === 'PUT';
      });
      expect(hasSkillPut).toBe(true);
    });

    // Delete second row
    const delBtns = screen.getAllByLabelText('Delete skill');
    fireEvent.click(delBtns[1]);
    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((c: any[]) => ({ url: typeof c[0] === 'string' ? c[0] : c[0].toString(), init: c[1] }));
      expect(calls.some((c: any) => c.url.match(/\/api\/skills\/\d+$/) && c.init?.method === 'DELETE')).toBe(true);
    });
  });

  it('shows an error notification when create skill fails', async () => {
    // First render
    renderWithProviders(<SkillsAdminPage />);
    await waitFor(() => expect(screen.queryByText('Laden…')).not.toBeInTheDocument());

    // Next POST responds with server error JSON
    (global.fetch as any).mockImplementationOnce(async (input: any, init?: any) => {
      return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({ error: 'DB constraint' }) } as any;
    });

    fireEvent.click(screen.getByText(/Nieuw/));
    const codeInput = screen.getByLabelText('Skill code') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Opslaan'));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent || '').toMatch(/DB constraint|Opslaan mislukt/);
    });
  });
});
