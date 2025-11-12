import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3333';
const url = (p: string) => new URL(p, API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3333')).toString();

async function extractError(res: Response): Promise<string> {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body: any = await res.json().catch(() => ({}));
      if (body && (body.error || body.message)) return String(body.error || body.message);
    } else {
      const text = await res.text();
      if (text) return text;
    }
  } catch {}
  return `Request failed (${res.status})`;
}

export type Club = { id: number; name: string; shortName: string; slug: string; logoUrl?: string | null };
export type Player = { id: number; clubId: number; name: string; shirtNo?: number | null; gender?: 'male' | 'female' | null; photoUrl?: string | null };

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: async (): Promise<Club[]> => {
      const res = await fetch(url('/api/clubs'));
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
      const res = await fetch(url(`/api/clubs/${slug}/players`));
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
      const res = await fetch(url('/api/clubs/import'), {
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
      const res = await fetch(url(`/api/clubs/${slug}`), { method: 'DELETE' });
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
      const res = await fetch(url('/api/clubs/import/league-teams'), {
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
