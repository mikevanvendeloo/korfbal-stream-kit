import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import VmixCallsheetPushSettings from './VmixCallsheetPushSettings';

const colors = {normal: {background: '#22C55E', text: '#FFFFFF'}, warning: {background: '#F97316', text: '#FFFFFF'}, overtime: {background: '#EF4444', text: '#FFFFFF'}};
const config = {
  enabled: true, input: 'Callsheet', positions: ['Presentatie'], warningSeconds: 10,
  current: {titleField: 'Titel.Text', timerField: '', startTimeField: '', backgroundField: '', textColorFields: [], colors},
  next: {titleField: '', durationField: '', startsInField: '', startTimeField: '', backgroundField: '', textColorFields: [], colors},
};

describe('VmixCallsheetPushSettings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows one position, chosen from a list', async () => {
    const saved: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/production/positions')) return new Response(JSON.stringify([{id: 14, name: 'Presentatie'}, {id: 16, name: 'Analist'}]));
      if (u.includes('/api/settings/vmix-callsheet-push') && init?.method === 'PUT') {
        saved.push(JSON.parse(String(init.body)));
        return new Response(String(init.body));
      }
      if (u.includes('/api/settings/vmix-callsheet-push')) return new Response(JSON.stringify(config));
      return new Response(JSON.stringify([{productionId: null}]));
    }));
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><VmixCallsheetPushSettings/></QueryClientProvider>);

    const select = await screen.findByLabelText('Positie') as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(3));
    expect(select.value).toBe('Presentatie');
    expect(screen.queryAllByRole('checkbox', {name: 'Analist'})).toHaveLength(0);

    fireEvent.change(select, {target: {value: 'Analist'}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect((saved[0] as { positions: string[] }).positions).toEqual(['Analist']);

    fireEvent.change(select, {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect((saved[1] as { positions: string[] }).positions).toEqual([]);
  });

  it('chooses the title from the inputs vMix reports, and warns about a name vMix does not have', async () => {
    const saved: unknown[] = [];
    const inputs = [
      {key: 'k-1', number: 1, type: 'Capture', title: 'Camera 1', fields: []},
      {key: 'k-2', number: 2, type: 'GT', title: 'Callsheet.gtzip', fields: ['Titel.Text', 'Timer.Text']},
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/vmix/inputs')) return new Response(JSON.stringify({instance: 'Stream-PC', inputs}));
      if (u.includes('/api/production/positions')) return new Response(JSON.stringify([{id: 14, name: 'Presentatie'}]));
      if (u.includes('/api/settings/vmix-callsheet-push') && init?.method === 'PUT') {
        saved.push(JSON.parse(String(init.body)));
        return new Response(String(init.body));
      }
      if (u.includes('/api/settings/vmix-callsheet-push')) return new Response(JSON.stringify(config));
      return new Response(JSON.stringify([{productionId: null}]));
    }));
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><VmixCallsheetPushSettings/></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', {name: 'Inputs ophalen uit vMix'}));
    // "Callsheet" is not the exact title: vMix would ignore it
    expect(await screen.findByText(/vMix heeft geen input "Callsheet"/)).toBeInTheDocument();
    const picker = screen.getByLabelText('Kies een title uit vMix') as HTMLSelectElement;
    // Only titles (inputs with text fields) to choose from
    expect([...picker.options].map((o) => o.text)).toEqual(['Kies een title…', '2. Callsheet.gtzip (GT)']);

    fireEvent.change(picker, {target: {value: 'k-2'}});
    expect(screen.getByLabelText('vMix title (naam, nummer of key)')).toHaveValue('k-2');
    expect(await screen.findByText(/input 2, Callsheet.gtzip/)).toBeInTheDocument();
    expect([...document.querySelectorAll('#vmix-title-fields option')].map((o) => o.getAttribute('value'))).toEqual(['Titel.Text', 'Timer.Text']);

    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect((saved[0] as { input: string }).input).toBe('k-2');
  });
});
