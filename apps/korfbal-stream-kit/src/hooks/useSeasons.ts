import {useEffect} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {io} from 'socket.io-client';
import {createUrl, extractError, getSocketUrl} from '../lib/api';

export interface SeasonDto {
  id: number;
  startYear: number;
  name: string; // "2026/2027"
  startDate: string; // ISO
  endDate: string; // ISO
  isActive: boolean;
  matchCount: number;
  playerCount: number;
  createdAt: string;
}

export interface SeasonSuggestion {
  startYear: number;
  name: string;
}

export const seasonKeys = {
  all: ['seasons'] as const,
  active: ['seasons', 'active'] as const,
  suggestNext: ['seasons', 'suggest-next'] as const,
};

/**
 * Validates a season name of the form "YYYY/YYYY+1" (e.g. "2026/2027").
 * Returns a Dutch error message, or null when the name is valid.
 */
export function validateSeasonName(raw: string): string | null {
  const name = raw.trim();
  const m = /^(\d{4})\/(\d{4})$/.exec(name);
  if (!m) return 'Gebruik het formaat JJJJ/JJJJ, bijvoorbeeld 2026/2027';
  const first = Number(m[1]);
  const second = Number(m[2]);
  if (second !== first + 1) return `Het tweede jaar moet ${first + 1} zijn (bijvoorbeeld ${first}/${first + 1})`;
  return null;
}

export function useSeasons() {
  return useQuery({
    queryKey: seasonKeys.all,
    queryFn: async (): Promise<SeasonDto[]> => {
      const res = await fetch(createUrl('/api/seasons'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

/** Server event sent when any browser changes the active season (payload: the new active SeasonDto). */
export const SEASON_CHANGED_EVENT = 'season_changed';

/** The active season rarely changes, and every change invalidates it (mutations + socket event). */
const ACTIVE_SEASON_STALE_TIME_MS = 5 * 60 * 1000;

export function useActiveSeason() {
  return useQuery({
    queryKey: seasonKeys.active,
    staleTime: ACTIVE_SEASON_STALE_TIME_MS,
    queryFn: async (): Promise<SeasonDto> => {
      const res = await fetch(createUrl('/api/seasons/active'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSuggestNextSeason() {
  return useQuery({
    queryKey: seasonKeys.suggestNext,
    queryFn: async (): Promise<SeasonSuggestion> => {
      const res = await fetch(createUrl('/api/seasons/suggest-next'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSetActiveSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seasonId: number): Promise<SeasonDto> => {
      const res = await fetch(createUrl('/api/seasons/active'), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({seasonId}),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    // All season-scoped lists (productions, matches, clubs, players, reports...) change → refetch everything.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useCreateSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; activate?: boolean }): Promise<SeasonDto> => {
      const res = await fetch(createUrl('/api/seasons'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: input.name.trim(), activate: input.activate ?? false}),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (season) => {
      if (season.isActive) return qc.invalidateQueries();
      return qc.invalidateQueries({queryKey: seasonKeys.all});
    },
  });
}

export function useDeleteSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const res = await fetch(createUrl(`/api/seasons/${id}`), {method: 'DELETE'});
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({queryKey: seasonKeys.all}),
  });
}

/**
 * Refetches everything when another crew browser switches the active season: almost every list
 * (productions, matches, clubs, players, reports) is season-scoped. Mount once for the whole app.
 */
export function useSeasonChangedSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = io(getSocketUrl(), {transports: ['websocket', 'polling']});
    const onSeasonChanged = (season: SeasonDto) => {
      qc.setQueryData(seasonKeys.active, season);
      void qc.invalidateQueries();
    };
    socket.on(SEASON_CHANGED_EVENT, onSeasonChanged);
    return () => {
      socket.off(SEASON_CHANGED_EVENT, onSeasonChanged);
      socket.disconnect();
    };
  }, [qc]);
}
