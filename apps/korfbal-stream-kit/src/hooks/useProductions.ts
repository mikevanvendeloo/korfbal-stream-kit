import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type ProductionPersonPosition = {
  id: number;
  productionId: number;
  personId: number;
  positionId: number;
  createdAt: string;
  person: { id: number; name: string; gender: 'male' | 'female' };
  position: { id: number; name: string; isStudio: boolean };
};

export type Production = {
  id: number;
  matchScheduleId: number;
  createdAt: string;
  isActive?: boolean;
  liveTime?: string; // NIEUW: liveTime toegevoegd
  matchSchedule?: any;
  productionPersons?: ProductionPerson[];
  productionPositions?: ProductionPersonPosition[]; // NIEUW: Productie-brede positie toewijzingen
};
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
      // De backend moet de productionPositions includen, anders is dit type-cast niet veilig
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
    mutationFn: async (input: { id: number; matchScheduleId?: number; liveTime?: string | null }): Promise<Production> => {
      const res = await fetch(createUrl(`/api/production/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['productions'] });
      qc.invalidateQueries({ queryKey: ['production', data.id] });
    },
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

export type SegmentAssignment = { id: number; personId: number; positionId: number; person: { id: number; name: string; gender: 'male' | 'female' }; position: { id: number; name: string; isStudio: boolean } };

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

// NIEUW: Type voor Position
export type Position = { id: number; name: string; isStudio: boolean; skillId?: number | null; skill?: any };

// NIEUW: Hook om alle posities op te halen
// NIEUW: Hook om alle posities op te halen
export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async (): Promise<Position[]> => {
      // FOUT: createUrl('/api/positions')
      // CORRECT: createUrl('/api/production/positions')
      const res = await fetch(createUrl('/api/production/positions'));
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

// NIEUW: Hooks voor ProductionPersonPosition
export function useProductionPersonPositions(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'person-positions'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionPersonPosition[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/person-positions`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

// NIEUW: Mutatie om ProductionPersonPositions te updaten (meerdere tegelijk)
export function useUpdateProductionPersonPositions(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; positionIds: number[] }): Promise<void> => {
      // Haal de huidige toewijzingen op voor deze persoon
      const currentAssignments = qc.getQueryData<ProductionPersonPosition[]>(['production', productionId, 'person-positions']) || [];
      const currentPersonAssignments = currentAssignments.filter(pa => pa.personId === input.personId);
      const currentPositionIds = new Set(currentPersonAssignments.map(pa => pa.positionId));

      const toAdd = input.positionIds.filter(pid => !currentPositionIds.has(pid));
      const toRemove = currentPersonAssignments.filter(pa => !input.positionIds.includes(pa.positionId));

      const promises: Promise<any>[] = [];

      for (const positionId of toAdd) {
        promises.push(
          fetch(createUrl(`/api/production/${productionId}/person-positions`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId: input.personId, positionId }),
          }).then(res => {
            if (!res.ok) throw new Error('Failed to add position');
            return res.json();
          })
        );
      }

      for (const assignment of toRemove) {
        promises.push(
          fetch(createUrl(`/api/production/${productionId}/person-positions/${assignment.id}`), {
            method: 'DELETE',
          }).then(res => {
            if (!res.ok && res.status !== 204) throw new Error('Failed to remove position');
          })
        );
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'person-positions'] });
      qc.invalidateQueries({ queryKey: ['production', productionId] }); // Invalideer hoofd productie query
      // Invalideer ook alle segment-specifieke toewijzingen, omdat de 'basis' is gewijzigd
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'segment' && q.queryKey[2] === 'assignments' });
    },
  });
}
