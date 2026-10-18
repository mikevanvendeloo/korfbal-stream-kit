import {describe, expect, it, vi} from 'vitest';
import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider, useQuery} from '@tanstack/react-query';
import {useUpdateManualMatch} from './useManualMatches';
import {mockApi} from '../test/organizations';

/**
 * A manual match edit can move the match and rename its teams; the server moves the production's
 * times along. The productions list (and a production's own data) must be refetched, not just the matches.
 */
describe('useUpdateManualMatch', () => {
  it('invalidates the productions queries after a manual match edit', async () => {
    let productionsFetched = 0;
    mockApi(({method, path}) => {
      if (method === 'GET' && path === '/api/production') {
        productionsFetched++;
        return {items: [], total: 0};
      }
      if (method === 'PUT') return {id: 7, date: '2026-11-15T19:00:00.000Z', homeTeamName: 'Thuis', awayTeamName: 'Uit'};
      return {};
    });
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({children}: {children: React.ReactNode}) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

    const {result} = renderHook(() => ({
      update: useUpdateManualMatch(),
      productions: useQuery({queryKey: ['productions'], queryFn: async () => (await fetch('/api/production')).json()}),
    }), {wrapper});
    await waitFor(() => expect(result.current.productions.isSuccess).toBe(true));
    expect(productionsFetched).toBe(1);

    await act(() => result.current.update.mutateAsync({id: 7, date: '2026-11-15T19:00:00.000Z', homeTeamName: 'Thuis', awayTeamName: 'Uit'}));

    expect(invalidate).toHaveBeenCalledWith({queryKey: ['productions']});
    expect(invalidate).toHaveBeenCalledWith({queryKey: ['production']});
    await waitFor(() => expect(productionsFetched).toBe(2));
  });
});
