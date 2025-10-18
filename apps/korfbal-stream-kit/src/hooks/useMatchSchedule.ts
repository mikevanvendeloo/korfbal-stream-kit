import { useEffect, useRef, useState } from 'react';
import { fetchMatchSchedule, MatchSchedule } from '../lib/api';

export type LocationFilter = 'HOME' | 'AWAY' | 'ALL';

export function useMatchSchedule(date: string, location: LocationFilter = 'HOME', pollMs?: number) {
  const [data, setData] = useState<MatchSchedule[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await fetchMatchSchedule({ date, location });
      setData(res.items);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    load();
    if (pollMs && pollMs > 0) {
      timerRef.current = window.setInterval(load, pollMs);
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
    }
  }, [date, location, pollMs]);

  return { data, isLoading, isError: !!error, error, refetch: load };
}

export function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return formatDate(d);
}

export function prevDayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return formatDate(d);
}

// New helpers: move by one full week relative to given date
export function nextWeekStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return formatDate(d);
}

export function prevWeekStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  return formatDate(d);
}
