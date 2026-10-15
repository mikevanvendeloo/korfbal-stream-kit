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
});
