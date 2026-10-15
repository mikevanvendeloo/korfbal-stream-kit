import {render, renderHook, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import React from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import LiveCallsheetEntry from './LiveCallsheetEntry';
import {useActiveProduction} from '../hooks/useProductions';

function respond(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {status})));
}

const wrapper = ({children}: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>{children}</QueryClientProvider>
);

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderEntry(viewType: 'standard' | 'show-caller') {
  const path = viewType === 'show-caller' ? '/show-caller' : '/callsheet';
  render(
    <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={<LiveCallsheetEntry viewType={viewType}/>}/>
          <Route path="*" element={<Where/>}/>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useActiveProduction', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the server for the active production, whatever the season', async () => {
    respond({item: {id: 47, isActive: true}});
    const {result} = renderHook(() => useActiveProduction(), {wrapper});
    await waitFor(() => expect(result.current.data).toEqual({id: 47, isActive: true}));
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/production/active');
  });

  it('is null when no production is active', async () => {
    respond({item: null});
    const {result} = renderHook(() => useActiveProduction(), {wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('LiveCallsheetEntry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens the Show Caller of the active production with all items', async () => {
    respond({item: {id: 47, isActive: true}});
    renderEntry('show-caller');
    expect((await screen.findByTestId('where')).textContent).toBe('/show-caller/47/all');
  });

  it('opens the position choice of the callsheet', async () => {
    respond({item: {id: 47, isActive: true}});
    renderEntry('standard');
    expect((await screen.findByTestId('where')).textContent).toBe('/callsheet/47');
  });

  it('says so when no production is active', async () => {
    respond({item: null});
    renderEntry('standard');
    expect(await screen.findByText('Geen actieve productie gevonden.')).toBeTruthy();
  });

  it('shows a failure to load', async () => {
    respond({error: 'Database is currently unavailable'}, 503);
    renderEntry('show-caller');
    expect(await screen.findByText(/Fout bij laden/)).toBeTruthy();
  });
});
