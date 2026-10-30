import {act, renderHook} from '@testing-library/react';
import {DEVICE_FAILURE_THRESHOLD, usePolledDevice} from './usePolledDevice';

const hasItems = (d: number[]) => d.length > 0;

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('usePolledDevice', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('polls and reports connected with data', async () => {
    const fetcher = vi.fn().mockResolvedValue([1]);
    const {result} = renderHook(() => usePolledDevice(fetcher, 1000, hasItems));
    await tick(0);
    expect(result.current.status).toBe('connected');
    expect(result.current.data).toEqual([1]);
    await tick(2000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('keeps the connection and the last data after one failed poll', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([7])
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValue([8]);
    const {result} = renderHook(() => usePolledDevice(fetcher, 1000, hasItems));
    await tick(0);
    await tick(1000);
    expect(result.current.status).toBe('connected');
    expect(result.current.data).toEqual([7]);
    await tick(1000);
    expect(result.current.data).toEqual([8]);
  });

  it(`stops polling after ${DEVICE_FAILURE_THRESHOLD} failures in a row and clears the data`, async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([1])
      .mockRejectedValue(new Error('502'));
    const {result} = renderHook(() => usePolledDevice(fetcher, 1000, hasItems));
    await tick(0);
    await tick(1000);
    await tick(1000);
    expect(result.current.status).toBe('connected');
    await tick(1000);
    expect(result.current.status).toBe('disconnected');
    expect(result.current.connected).toBe(false);
    expect(result.current.data).toBeNull();
    const calls = fetcher.mock.calls.length;
    await tick(10_000);
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it('counts an unusable answer (empty list) as a failure', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const {result} = renderHook(() => usePolledDevice(fetcher, 1000, hasItems));
    await tick(0);
    await tick(2000);
    expect(result.current.status).toBe('disconnected');
  });

  it('reconnect tries right away and resumes polling on success', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('502'));
    const {result} = renderHook(() => usePolledDevice(fetcher, 1000, hasItems));
    await tick(0);
    await tick(2000);
    expect(result.current.status).toBe('disconnected');
    expect(fetcher).toHaveBeenCalledTimes(3);

    fetcher.mockResolvedValue([5]);
    act(() => result.current.reconnect());
    await tick(0);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(result.current.status).toBe('connected');
    expect(result.current.data).toEqual([5]);
    await tick(1000);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('skips a tick while a request is still in flight', async () => {
    let resolve: (v: number[]) => void = () => undefined;
    const fetcher = vi.fn(() => new Promise<number[]>((r) => { resolve = r; }));
    renderHook(() => usePolledDevice(fetcher, 500, hasItems));
    await tick(1500);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => resolve([1]));
    await tick(500);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stops polling on unmount', async () => {
    const fetcher = vi.fn().mockResolvedValue([1]);
    const {unmount} = renderHook(() => usePolledDevice(fetcher, 1000, hasItems));
    await tick(0);
    unmount();
    await tick(5000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
