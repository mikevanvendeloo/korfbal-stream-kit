import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type Production = { id: number; matchScheduleId: number; createdAt: string; isActive?: boolean; matchSchedule?: any };
export type MatchCandidate = { id: number; date: string; homeTeamName: string; awayTeamName: string };

export function useProductionMatches() {
  return useQuery({
    queryKey: ['production-matches'],
    queryFn: async (): Promise<{ items: MatchCandidate[]; filters: string[] }> => {
      const res = await fetch(createUrl('/api/production/matches'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useProductions() {
  return useQuery({
    queryKey: ['productions'],
    queryFn: async (): Promise<{ items: Production[]; total: number }> => {
      const res = await fetch(createUrl('/api/production').toString());
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
      const res = await fetch(createUrl(`/api/production/${id}`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { matchScheduleId: number }): Promise<Production> => {
      const res = await fetch(createUrl('/api/production'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
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
      const res = await fetch(createUrl(`/api/production/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchScheduleId: input.matchScheduleId }) });
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
      const res = await fetch(createUrl(`/api/production/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

export function useActivateProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/${id}/activate`), { method: 'POST' });
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
      const res = await fetch(createUrl(`/api/production/${productionId}/segments`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateSegment(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { naam: string; duurInMinuten: number; volgorde?: number; isTimeAnchor?: boolean }): Promise<ProductionSegment> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/segments`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      // Segments changed => refresh segments list and timing for this production
      qc.invalidateQueries({ queryKey: ['production', productionId, 'segments'] });
      qc.invalidateQueries({ queryKey: ['production', productionId, 'timing'] });
    },
  });
}

export function useUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; naam?: string; duurInMinuten?: number; volgorde?: number; isTimeAnchor?: boolean }): Promise<ProductionSegment> => {
      const res = await fetch(createUrl(`/api/production/segments/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (data) => {
      // Prefer targeted invalidation when productionId is known
      if (data && typeof data.productionId === 'number') {
        qc.invalidateQueries({ queryKey: ['production', data.productionId, 'segments'] });
        qc.invalidateQueries({ queryKey: ['production', data.productionId, 'timing'] });
      } else {
        // Fallback: invalidate all segments and timing queries
        qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('segments') });
        qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('timing') });
      }
    },
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (segmentId: number) => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      // Segment list and timing may change after delete
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('segments') });
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes('timing') });
    },
  });
}

export function useProductionTiming(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'timing'],
    enabled: !!productionId,
    queryFn: async (): Promise<Array<ProductionSegment & { start: string; end: string }>> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/timing`));
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
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/assignments`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useAddSegmentAssignment(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; positionId: number }): Promise<SegmentAssignment> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/assignments`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
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
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/assignments/${assignmentId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segment', segmentId, 'assignments'] }),
  });
}

export function useCopySegmentAssignments(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetSegmentIds: number[]; mode?: 'merge' | 'overwrite' }): Promise<{ ok: boolean }> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/assignments/copy`), {
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
export type CrewPerson = { id: number; name: string; gender: 'male' | 'female'; skillIds?: number[] };
export function useCrewPersonsForSegment(segmentId: number) {
  return useQuery({
    queryKey: ['segment', segmentId, 'crew-persons'],
    enabled: !!segmentId,
    queryFn: async (): Promise<CrewPerson[]> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/persons`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export type SegmentDefaultPosition = { id: number; name: string; order: number; requiredSkillCode: string | null };
export function useSegmentDefaultPositions(segmentId: number) {
  return useQuery({
    queryKey: ['segment', segmentId, 'default-positions'],
    enabled: !!segmentId,
    queryFn: async (): Promise<SegmentDefaultPosition[]> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/positions`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export type ProductionPerson = { id: number; productionId: number; personId: number; person: { id: number; name: string; gender: 'male' | 'female' }; createdAt: string };

export function useProductionPersons(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'persons'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionPerson[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/persons`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useAddProductionPerson(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number }): Promise<ProductionPerson> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/persons`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'persons'] }),
  });
}

export function useDeleteProductionPerson(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productionPersonId: number) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/persons/${productionPersonId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'persons'] }),
  });
}
