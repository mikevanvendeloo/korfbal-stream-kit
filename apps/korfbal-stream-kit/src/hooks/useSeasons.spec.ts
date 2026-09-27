import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {type Mock, vi} from 'vitest';
import {io} from 'socket.io-client';
import {
  SEASON_CHANGED_EVENT,
  seasonKeys,
  useActiveSeason,
  useCreateSeason,
  useDeleteSeason,
  useSeasonChangedSync,
  useSeasons,
  useSetActiveSeason,
  validateSeasonName,
} from './useSeasons';
import {getSharedSocket} from '../lib/socket';

vi.mock('socket.io-client', () => {
  const socket = {on: vi.fn(), off: vi.fn(), disconnect: vi.fn()};
  return {io: vi.fn(() => socket)};
});

const season = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 1, startYear: 2025, name: '2025/2026',
  startDate: '2025-06-30T22:00:00.000Z', endDate: '2026-06-30T21:59:59.999Z',
  isActive: true, matchCount: 3, playerCount: 10, createdAt: '2025-07-01T00:00:00.000Z',
  ...over,
});

const ok = (data: unknown, status = 200) => ({
  ok: true, status, headers: new Headers({'content-type': 'application/json'}), json: async () => data,
});

describe('validateSeasonName', () => {
  it('accepts YYYY/YYYY+1', () => {
    expect(validateSeasonName('2026/2027')).toBeNull();
    expect(validateSeasonName(' 2026/2027 ')).toBeNull();
  });

  it('rejects bad formats and non-consecutive years', () => {
    expect(validateSeasonName('2026-2027')).toMatch(/formaat/i);
    expect(validateSeasonName('26/27')).toMatch(/formaat/i);
    expect(validateSeasonName('')).toMatch(/formaat/i);
    expect(validateSeasonName('2026/2028')).toMatch(/2027/);
  });
});

describe('useSeasons hooks', () => {
  let queryClient: QueryClient;
  let fetchMock: Mock;
  const wrapper = ({children}: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, {client: queryClient}, children);

  beforeEach(() => {
    queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('useSeasons fetches the season list', async () => {
    fetchMock.mockResolvedValue(ok([season()]));
    const {result} = renderHook(() => useSeasons(), {wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].name).toBe('2025/2026');
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/api/seasons');
  });

  it('useActiveSeason fetches the active season', async () => {
    fetchMock.mockResolvedValue(ok(season()));
    const {result} = renderHook(() => useActiveSeason(), {wrapper});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/api/seasons/active');
  });

  it('useActiveSeason keeps the active season fresh for a while instead of refetching on every mount', async () => {
    fetchMock.mockResolvedValue(ok(season()));
    const first = renderHook(() => useActiveSeason(), {wrapper});
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    const second = renderHook(() => useActiveSeason(), {wrapper});
    expect(second.result.current.data?.name).toBe('2025/2026');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('useSetActiveSeason PUTs the id and invalidates all queries', async () => {
    fetchMock.mockResolvedValue(ok(season({id: 2, name: '2026/2027'})));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const {result} = renderHook(() => useSetActiveSeason(), {wrapper});
    await act(async () => {
      await result.current.mutateAsync(2);
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('/api/seasons/active');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({seasonId: 2});
    // called without filters → everything is invalidated
    expect(spy).toHaveBeenCalledWith();
  });

  it('useCreateSeason POSTs name + activate and invalidates everything when activated', async () => {
    fetchMock.mockResolvedValue(ok(season({id: 3, name: '2027/2028', isActive: true}), 201));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const {result} = renderHook(() => useCreateSeason(), {wrapper});
    await act(async () => {
      await result.current.mutateAsync({name: '2027/2028', activate: true});
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({name: '2027/2028', activate: true});
    expect(spy).toHaveBeenCalledWith();
  });

  it('useCreateSeason only invalidates seasons when not activated', async () => {
    fetchMock.mockResolvedValue(ok(season({id: 3, name: '2027/2028', isActive: false}), 201));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const {result} = renderHook(() => useCreateSeason(), {wrapper});
    await act(async () => {
      await result.current.mutateAsync({name: '2027/2028'});
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({name: '2027/2028', activate: false});
    expect(spy).toHaveBeenCalledWith({queryKey: ['seasons']});
  });

  it('useCreateSeason surfaces the server error (409)', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 409, headers: new Headers({'content-type': 'application/json'}),
      json: async () => ({error: 'Seizoen bestaat al'}),
    });
    const {result} = renderHook(() => useCreateSeason(), {wrapper});
    await act(async () => {
      await expect(result.current.mutateAsync({name: '2025/2026'})).rejects.toThrow('Seizoen bestaat al');
    });
  });

  it('useDeleteSeason sends DELETE and accepts 204', async () => {
    fetchMock.mockResolvedValue({ok: true, status: 204});
    const {result} = renderHook(() => useDeleteSeason(), {wrapper});
    await act(async () => {
      await result.current.mutateAsync(5);
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('/api/seasons/5');
    expect(init.method).toBe('DELETE');
  });

  it('useSeasonChangedSync refetches everything when another browser switches the season', async () => {
    const socket = (io as unknown as Mock)();
    socket.on.mockClear();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const {unmount} = renderHook(() => useSeasonChangedSync(), {wrapper});

    const [event, handler] = socket.on.mock.calls.find(([e]: [string]) => e === SEASON_CHANGED_EVENT);
    expect(event).toBe(SEASON_CHANGED_EVENT);
    act(() => handler(season({id: 9, name: '2027/2028'})));

    expect(queryClient.getQueryData(seasonKeys.active)).toMatchObject({id: 9, name: '2027/2028'});
    expect(spy).toHaveBeenCalledWith();

    unmount();
    expect(socket.off).toHaveBeenCalledWith(SEASON_CHANGED_EVENT, handler);
    // The shared app socket stays open for the other hooks.
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('useSeasonChangedSync reuses the shared app socket instead of opening a connection per mount', () => {
    const ioMock = io as unknown as Mock;
    const callsBefore = ioMock.mock.calls.length;
    const first = renderHook(() => useSeasonChangedSync(), {wrapper});
    const second = renderHook(() => useSeasonChangedSync(), {wrapper});
    first.unmount();
    second.unmount();
    renderHook(() => useSeasonChangedSync(), {wrapper});

    // At most the single lazy creation of the shared socket, never one connection per mount.
    expect(ioMock.mock.calls.length - callsBefore).toBeLessThanOrEqual(1);
    expect(getSharedSocket()).toBe(getSharedSocket());
  });
});
