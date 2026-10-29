import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import DraaiboekFileActions from './DraaiboekFileActions';

const downloadExport = vi.fn();
vi.mock('../lib/download', () => ({downloadExport: (...args: unknown[]) => downloadExport(...args)}));

type Call = { method: string; path: string; body: unknown };
let calls: Call[] = [];
let answer: () => Response;

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});

function renderActions(callSheetId?: number) {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  render(
    <QueryClientProvider client={qc}>
      <DraaiboekFileActions productionId={3} callSheetId={callSheetId}/>
    </QueryClientProvider>,
  );
  return {invalidate};
}

const draaiboekFile = () => new File(['{"version":2,"items":[]}'], 'draaiboek.json', {type: 'application/json'});
const chooseFile = (file: File) => fireEvent.change(screen.getByLabelText('Draaiboekbestand (JSON)'), {target: {files: [file]}});

describe('DraaiboekFileActions', () => {
  beforeEach(() => {
    calls = [];
    downloadExport.mockClear();
    answer = () => json(200, {ok: true, items: 12, newChapters: ['Nabeschouwing']});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({method: init?.method ?? 'GET', path: new URL(String(input), 'http://localhost').pathname, body: init?.body});
      return answer();
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('downloads the draaiboek as JSON and as Excel through the API', () => {
    renderActions(5);
    fireEvent.click(screen.getByRole('button', {name: 'Exporteer JSON'}));
    fireEvent.click(screen.getByRole('button', {name: 'Exporteer Excel'}));
    expect(downloadExport).toHaveBeenCalledWith('/api/production/callsheets/5/export-json', 'draaiboek-3.json');
    expect(downloadExport).toHaveBeenCalledWith('/api/production/callsheets/5/export-excel', 'draaiboek-3.xlsx');
  });

  it('imports only after the confirmation, then shows the result and refreshes the draaiboek', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const {invalidate} = renderActions(5);
    chooseFile(draaiboekFile());

    expect(confirm.mock.calls[0][0]).toMatch(/^Het draaiboek van deze productie wordt vervangen/);
    expect(await screen.findByRole('status')).toHaveTextContent('12 items geïmporteerd; nieuwe hoofdstuk: Nabeschouwing.');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.path).toBe('/api/production/callsheets/5/import-json');
    expect((post?.body as FormData).get('file')).toBeInstanceOf(File);
    expect(invalidate).toHaveBeenCalledWith({queryKey: ['production', 'callsheets', 5]});
    expect(invalidate).toHaveBeenCalledWith({queryKey: ['production', 3]});
  });

  it('leaves the draaiboek alone when the confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderActions(5);
    chooseFile(draaiboekFile());
    expect(calls).toEqual([]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the API message when the file is refused', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    answer = () => json(400, {error: 'Ongeldig draaiboekbestand: items ontbreken'});
    renderActions(5);
    chooseFile(draaiboekFile());
    expect(await screen.findByRole('alert')).toHaveTextContent('Ongeldig draaiboekbestand: items ontbreken');
  });

  it('is disabled without a draaiboek', async () => {
    renderActions(undefined);
    for (const name of ['Exporteer JSON', 'Exporteer Excel', 'Importeer draaiboek']) {
      expect(screen.getByRole('button', {name})).toBeDisabled();
    }
    await waitFor(() => expect(calls).toEqual([]));
  });
});
