import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {afterEach, describe, expect, it, vi} from 'vitest';
import VmixInstancesSettings from './VmixInstancesSettings';

const stored = {
  instances: [{id: 'stream-pc', name: 'Stream-PC', url: 'http://10.0.0.10:8088'}],
  targets: {countdown: '', callsheet: ''},
};

function renderSettings() {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
    new Response(init?.body ? String(init.body) : JSON.stringify(stored)));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
      <VmixInstancesSettings/>
    </QueryClientProvider>
  );
  return fetchMock;
}

describe('VmixInstancesSettings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds a second vMix and sends the callsheet to it', async () => {
    const fetchMock = renderSettings();
    expect(await screen.findByRole('button', {name: 'Stream-PC verwijderen'})).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {name: /vMix toevoegen/}));
    fireEvent.change(screen.getByLabelText('Naam', {selector: '#vmix-name-1'}), {target: {value: 'Scherm-PC'}});
    fireEvent.change(screen.getByLabelText('Web Controller URL', {selector: '#vmix-url-1'}), {target: {value: 'http://10.0.0.11:8088'}});
    const callsheet = screen.getByLabelText(/Callsheet naar vMix/) as HTMLSelectElement;
    fireEvent.change(callsheet, {target: {value: callsheet.options[2].value}});
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(String(init?.body));
    expect(body.instances.map((i: { name: string }) => i.name)).toEqual(['Stream-PC', 'Scherm-PC']);
    expect(body.targets).toEqual({countdown: '', callsheet: body.instances[1].id});
  });

  it('falls back to the first vMix when the chosen one is removed', async () => {
    stored.targets.countdown = 'stream-pc';
    const fetchMock = renderSettings();
    await screen.findByRole('button', {name: 'Stream-PC verwijderen'});
    fireEvent.click(screen.getByRole('button', {name: 'Stream-PC verwijderen'}));
    fireEvent.click(screen.getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({instances: [], targets: {countdown: '', callsheet: ''}});
  });
});
