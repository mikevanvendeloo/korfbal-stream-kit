import {useCallback, useEffect, useRef, useState} from 'react';

/** Consecutive failed polls after which a device counts as disconnected and polling stops. */
export const DEVICE_FAILURE_THRESHOLD = 3;

/**
 * connecting: no successful poll yet since the (re)start;
 * connected: the last poll gave usable data (or fewer than the threshold failed since);
 * disconnected: polling stopped after DEVICE_FAILURE_THRESHOLD failures in a row, until reconnect().
 */
export type DeviceStatus = 'connecting' | 'connected' | 'disconnected';

export type PolledDevice<T> = {
  data: T | null;
  status: DeviceStatus;
  connected: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Restarts polling of a disconnected device: one try right away, then the normal interval. */
  reconnect: () => void;
  refetch: () => void;
};

/**
 * Polls a device every `pollMs`. A poll fails when the fetcher throws or `isUsable` rejects the answer.
 * One failed poll keeps the last data; DEVICE_FAILURE_THRESHOLD failures in a row clear the data and stop
 * polling. A tick is skipped while a request is still in flight.
 */
export function usePolledDevice<T>(
  fetcher: () => Promise<T>,
  pollMs: number,
  isUsable: (data: T) => boolean = () => true,
): PolledDevice<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<DeviceStatus>('connecting');
  const [isLoading, setIsLoading] = useState(true);
  // Bumped by reconnect/refetch to restart the polling effect.
  const [run, setRun] = useState(0);

  const fetcherRef = useRef(fetcher);
  const usableRef = useRef(isUsable);
  fetcherRef.current = fetcher;
  usableRef.current = isUsable;

  const polling = status !== 'disconnected';

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    let timer: number | null = null;

    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };

    const fail = (e: Error) => {
      failures += 1;
      setError(e);
      if (failures >= DEVICE_FAILURE_THRESHOLD) {
        stop();
        setData(null);
        setStatus('disconnected');
      }
    };

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetcherRef.current();
        if (cancelled) return;
        if (!usableRef.current(res)) {
          fail(new Error('Geen bruikbare gegevens van het apparaat'));
          return;
        }
        failures = 0;
        setError(null);
        setData(res);
        setStatus('connected');
      } catch (e) {
        if (!cancelled) fail(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight = false;
        if (!cancelled) setIsLoading(false);
      }
    };

    void poll();
    timer = window.setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      stop();
    };
  }, [pollMs, polling, run]);

  const reconnect = useCallback(() => {
    setError(null);
    setStatus('connecting');
    setRun((n) => n + 1);
  }, []);

  return {
    data,
    status,
    connected: status === 'connected',
    isLoading,
    isError: !!error,
    error,
    reconnect,
    refetch: reconnect,
  };
}
