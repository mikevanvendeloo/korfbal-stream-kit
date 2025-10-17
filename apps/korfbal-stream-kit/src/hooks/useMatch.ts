import { useEffect, useRef, useState } from 'react';
import { fetchScoreboard, fetchShotclock, fetchMatchClock, ScoreboardItem, ShotclockItem, MatchClockItem } from '../lib/api';

export function useScoreboard(pollMs: number = 1000) {
  const [data, setData] = useState<ScoreboardItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await fetchScoreboard();
      setData(res);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, pollMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [pollMs]);

  return { data, isLoading, isError: !!error, error, refetch: load };
}

export function useShotclock(pollMs: number = 500) {
  const [data, setData] = useState<ShotclockItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await fetchShotclock();
      setData(res);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, pollMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [pollMs]);

  return { data, isLoading, isError: !!error, error, refetch: load };
}


export function useMatchClock(pollMs: number = 1000) {
  const [data, setData] = useState<MatchClockItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await fetchMatchClock();
      setData(res);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, pollMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [pollMs]);

  return { data, isLoading, isError: !!error, error, refetch: load };
}
