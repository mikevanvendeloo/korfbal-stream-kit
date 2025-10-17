import { useEffect, useRef, useState } from 'react';
import { fetchProgram, ProgramMatch } from '../lib/api';

export type LocationFilter = 'HOME' | 'AWAY' | 'ALL';

export function useProgram(date: string, location: LocationFilter = 'HOME', pollMs?: number) {
  const [data, setData] = useState<ProgramMatch[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await fetchProgram({ date, location });
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

function getNextSaturday(date: Date, dir: 1 | -1): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // JS: 0=Sun ... 6=Sat
  let day = d.getUTCDay();
  // Move at least one day in the chosen direction
  d.setUTCDate(d.getUTCDate() + dir);
  day = d.getUTCDay();
  const delta = (6 - day + 7) % 7; // days to next Saturday
  if (dir === -1) {
    // days back to previous Saturday
    const back = (day + 1) % 7; // distance to Sunday
    const toPrevSat = (day - 6 + 7) % 7;
    d.setUTCDate(d.getUTCDate() - (toPrevSat === 0 ? 7 : toPrevSat));
  } else {
    d.setUTCDate(d.getUTCDate() + (delta === 0 ? 7 : delta));
  }
  return d;
}

export function nextSaturdayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const n = getNextSaturday(d, 1);
  return formatDate(n);
}

export function prevSaturdayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  // Find previous Saturday
  const day = d.getUTCDay();
  const toPrevSat = (day - 6 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - (toPrevSat === 0 ? 7 : toPrevSat));
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
