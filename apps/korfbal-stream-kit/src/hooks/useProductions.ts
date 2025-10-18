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

export type Production = { id: number; matchScheduleId: number; createdAt: string; matchSchedule?: any };
export type MatchCandidate = { id: number; date: string; homeTeamName: string; awayTeamName: string };

export function useProductionMatches() {
  return useQuery({
    queryKey: ['production-matches'],
    queryFn: async (): Promise<{ items: MatchCandidate[]; filters: string[] }> => {
      const res = await fetch(url('/api/production/matches'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useProductions() {
  return useQuery({
    queryKey: ['productions'],
    queryFn: async (): Promise<{ items: Production[]; total: number }> => {
      const res = await fetch(url('/api/production'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { matchScheduleId: number }): Promise<Production> => {
      const res = await fetch(url('/api/production'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

export function useUpdateProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; matchScheduleId: number }): Promise<Production> => {
      const res = await fetch(url(`/api/production/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchScheduleId: input.matchScheduleId }) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

export function useDeleteProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(url(`/api/production/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

export type Assignment = { id: number; personId: number; capabilityId: number; person: { id: number; name: string; gender: 'male' | 'female' }; capability: { id: number; code: string; nameMale: string; nameFemale: string } };

export function useProductionAssignments(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'assignments'],
    enabled: !!productionId,
    queryFn: async (): Promise<Assignment[]> => {
      const res = await fetch(url(`/api/production/${productionId}/assignments`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useAddProductionAssignment(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; capabilityId: number }): Promise<Assignment> => {
      const res = await fetch(url(`/api/production/${productionId}/assignments`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (created) => {
      // Optimistically append to the cache so multiple roles for the same person show immediately
      const key = ['production', productionId, 'assignments'] as const;
      const prev = qc.getQueryData<Assignment[]>(key) || [];
      // Avoid duplicate append by id
      if (!prev.some((a) => a.id === created.id)) {
        qc.setQueryData<Assignment[]>(key, [...prev, created]);
      }
      // Trigger a refetch on a microtask to let the optimistic update render first
      setTimeout(() => qc.invalidateQueries({ queryKey: key }), 0);
    },
  });
}

export function useUpdateProductionAssignment(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; personId?: number; capabilityId?: number }): Promise<Assignment> => {
      const res = await fetch(url(`/api/production/${productionId}/assignments/${input.id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId: input.personId, capabilityId: input.capabilityId }) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'assignments'] }),
  });
}

export function useDeleteProductionAssignment(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await fetch(url(`/api/production/${productionId}/assignments/${assignmentId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'assignments'] }),
  });
}
