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

export type Production = { id: number; matchScheduleId: number; createdAt: string; isActive?: boolean; matchSchedule?: any };
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

export function useProduction(id: number) {
  return useQuery({
    queryKey: ['production', id],
    enabled: !!id,
    queryFn: async (): Promise<Production> => {
      const res = await fetch(url(`/api/production/${id}`));
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

export function useActivateProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(url(`/api/production/${id}/activate`), { method: 'POST' });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

export type ProductionSegment = { id: number; productionId: number; naam: string; volgorde: number; duurInMinuten: number; isTimeAnchor: boolean };

export function useProductionSegments(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'segments'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionSegment[]> => {
      const res = await fetch(url(`/api/production/${productionId}/segments`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateSegment(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { naam: string; duurInMinuten: number; volgorde?: number; isTimeAnchor?: boolean }): Promise<ProductionSegment> => {
      const res = await fetch(url(`/api/production/${productionId}/segments`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'segments'] }),
  });
}

export function useUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; naam?: string; duurInMinuten?: number; volgorde?: number; isTimeAnchor?: boolean }): Promise<ProductionSegment> => {
      const res = await fetch(url(`/api/production/segments/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate both list for its production and the single segment if any
      // We don't have productionId here; refresh all segment queries
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('segments') });
    },
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (segmentId: number) => {
      const res = await fetch(url(`/api/production/segments/${segmentId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('segments') });
    },
  });
}

export function useProductionTiming(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'timing'],
    enabled: !!productionId,
    queryFn: async (): Promise<Array<ProductionSegment & { start: string; end: string }>> => {
      const res = await fetch(url(`/api/production/${productionId}/timing`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export type SegmentAssignment = { id: number; personId: number; positionId: number; person: { id: number; name: string; gender: 'male' | 'female' }; position: { id: number; name: string } };

export function useSegmentAssignments(segmentId: number) {
  return useQuery({
    queryKey: ['segment', segmentId, 'assignments'],
    enabled: !!segmentId,
    queryFn: async (): Promise<SegmentAssignment[]> => {
      const res = await fetch(url(`/api/production/segments/${segmentId}/assignments`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useAddSegmentAssignment(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; positionId: number }): Promise<SegmentAssignment> => {
      const res = await fetch(url(`/api/production/segments/${segmentId}/assignments`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segment', segmentId, 'assignments'] }),
  });
}

export function useDeleteSegmentAssignment(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await fetch(url(`/api/production/segments/${segmentId}/assignments/${assignmentId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segment', segmentId, 'assignments'] }),
  });
}

export function useCopySegmentAssignments(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetSegmentIds: number[]; mode?: 'merge' | 'overwrite' }): Promise<{ ok: boolean }> => {
      const res = await fetch(url(`/api/production/segments/${segmentId}/assignments/copy`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate the assignment lists for all target segments and the source
      qc.invalidateQueries({ queryKey: ['segment', segmentId, 'assignments'] });
      for (const tid of variables.targetSegmentIds) {
        qc.invalidateQueries({ queryKey: ['segment', tid, 'assignments'] });
      }
    },
  });
}

// Crew persons linked to the production of a given segment
export type CrewPerson = { id: number; name: string; gender: 'male' | 'female' };
export function useCrewPersonsForSegment(segmentId: number) {
  return useQuery({
    queryKey: ['segment', segmentId, 'crew-persons'],
    enabled: !!segmentId,
    queryFn: async (): Promise<CrewPerson[]> => {
      const res = await fetch(url(`/api/production/segments/${segmentId}/persons`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
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
