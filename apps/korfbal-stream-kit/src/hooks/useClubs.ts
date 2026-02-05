import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type Club = { id: number; name: string; shortName: string; slug: string; logoUrl?: string | null };
export type Player = { id: number; clubId: number; name: string; shirtNo?: number | null; gender?: 'male' | 'female' | null; photoUrl?: string | null; personType?: string | null; function?: string | null };

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: async (): Promise<Club[]> => {
      const res = await fetch(createUrl('/api/clubs'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useClubPlayers(slug: string | null) {
  return useQuery({
    queryKey: ['club', slug, 'players'],
    enabled: !!slug,
    queryFn: async (): Promise<Player[]> => {
      const res = await fetch(createUrl(`/api/clubs/${slug}/players`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useImportClubs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { teamId?: string; poolId?: string; apiUrl?: string }) => {
      const body: any = input.apiUrl ? { apiUrl: input.apiUrl } : { teamId: input.teamId, poolId: input.poolId };
      const res = await fetch(createUrl('/api/clubs/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clubs'] });
      // Let any players list also refetch (unknown slug here, so predicate match)
      await qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('players') });
    },
  });
}

export function useDeleteClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(createUrl(`/api/clubs/${slug}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
      return { ok: true } as const;
    },
    onSuccess: async (_data, slug) => {
      await qc.invalidateQueries({ queryKey: ['clubs'] });
      await qc.invalidateQueries({ queryKey: ['club', slug, 'players'] });
    },
  });
}

export function useImportLeagueTeams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { limit?: number }) => {
      const res = await fetch(createUrl('/api/clubs/import/league-teams'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: input?.limit }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json() as Promise<{ ok: boolean; clubsCreated: number; clubsUpdated: number; playersCreated: number; playersUpdated: number; problems?: string[] }>;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clubs'] });
      await qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('players') });
    },
  });
}
