import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';
import {Position, PositionCategory, SegmentDefaultPosition} from "./usePositions";
import {Person} from "./usePersons";
import {useProductionTitles} from "./useTitles";

export type Production = {
  id: number;
  matchScheduleId: number;
  isActive: boolean;
  liveTime?: string;
  matchSchedule?: {
    id: number;
    homeTeamName: string;
    awayTeamName: string;
    date: string;
  }
};

export type ProductionSegment = {
  id: number;
  productionId: number;
  naam: string;
  volgorde: number;
  duurInMinuten: number;
  isTimeAnchor: boolean;
};

export type ProductionTiming = {
  id: number;
  naam: string;
  volgorde: number;
  duurInMinuten: number;
  isTimeAnchor: boolean;
  start?: string;
  end?: string;
}

export type ProductionPerson = {
  id: number;
  personId: number;
  person: Person;
}

export type ProductionPersonPosition = {
  id: number;
  personId: number;
  positionId: number;
  person: Person;
  position: Position;
}

export type SegmentAssignment = {
  id: number;
  personId: number;
  positionId: number;
  person: Person;
  position: Position;
}

export type ProductionInterview = {
  id: number;
  titleDefinitionId: number | null;
  side: 'HOME' | 'AWAY';
  role: 'PLAYER' | 'COACH';
  player: {
    id: number;
    name: string;
    shirtNo?: number;
    function?: string;
    photoUrl?: string;
    image?: string;
  }
}

export type Match = {
  id: number;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
}

export function useProductions() {
  return useQuery({
    queryKey: ['productions'],
    queryFn: async (): Promise<{ items: Production[], total: number }> => {
      const res = await fetch(createUrl('/api/production'));
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

export function useProductionMatches() {
  return useQuery({
    queryKey: ['production', 'matches'],
    queryFn: async (): Promise<{ items: Match[] }> => {
      const res = await fetch(createUrl('/api/production/matches'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { matchScheduleId: number }): Promise<Production> => {
      const res = await fetch(createUrl('/api/production'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
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
      const res = await fetch(createUrl(`/api/production/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchScheduleId: input.matchScheduleId, liveTime: input.liveTime }),
      });
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
    mutationFn: async (id: number): Promise<Production> => {
      const res = await fetch(createUrl(`/api/production/${id}/activate`), {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

export function useImportProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any): Promise<void> => {
      const res = await fetch(createUrl('/api/production/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
  });
}

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
    mutationFn: async (input: { naam: string, duurInMinuten: number, volgorde: number, isTimeAnchor: boolean }): Promise<ProductionSegment> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/segments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'segments'] });
      qc.invalidateQueries({ queryKey: ['production', productionId, 'timing'] });
    }
  });
}

export function useUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number, naam?: string, duurInMinuten?: number, volgorde?: number, isTimeAnchor?: boolean }): Promise<ProductionSegment> => {
      const res = await fetch(createUrl(`/api/production/segments/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['production', data.productionId, 'segments'] });
      qc.invalidateQueries({ queryKey: ['production', data.productionId, 'timing'] });
    },
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/segments/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: (_data, id, context) => {
      const productionId = (context as any).productionId;
      qc.invalidateQueries({ queryKey: ['production', productionId, 'segments'] });
      qc.invalidateQueries({ queryKey: ['production', productionId, 'timing'] });
    },
  });
}

export function useProductionTiming(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'timing'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionTiming[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/timing`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    }
  });
}

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
      const res = await fetch(createUrl(`/api/production/${productionId}/persons`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'persons'] }),
  });
}

export function useDeleteProductionPerson(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/persons/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'persons'] }),
  });
}

export function useProductionPersonPositions(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'person-positions'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionPersonPosition[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/person-positions`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    }
  });
}

export function useUpdateProductionPersonPositions(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number, positionIds: number[] }): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/person-positions`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'person-positions'] }),
  });
}

export function useSegmentAssignments(segmentId: number) {
  return useQuery({
    queryKey: ['production', 'segments', segmentId, 'assignments'],
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
    mutationFn: async (input: { personId: number, positionId: number }): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/assignments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', 'segments', segmentId, 'assignments'] }),
  });
}

export function useDeleteSegmentAssignment(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/assignments/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', 'segments', segmentId, 'assignments'] }),
  });
}

export function useCopySegmentAssignments(segmentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetSegmentIds: number[], mode: 'replace' | 'append' }): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/copy-assignments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: (_data, vars) => {
      vars.targetSegmentIds.forEach(id => {
        qc.invalidateQueries({ queryKey: ['production', 'segments', id, 'assignments'] });
      });
    },
  });
}

export function useSegmentDefaultPositions(segmentId: number) {
  return useQuery({
    queryKey: ['segment-default-positions', segmentId],
    enabled: !!segmentId,
    queryFn: async (): Promise<SegmentDefaultPosition[]> => {
      const res = await fetch(createUrl(`/api/production/segments/${segmentId}/positions`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useProductionInterviews(productionId: number) {
  const { data: titles, isSuccess: titlesLoaded } = useProductionTitles(productionId);

  return useQuery({
    queryKey: ['production', productionId, 'interviews'],
    enabled: !!productionId && titlesLoaded,
    queryFn: async (): Promise<ProductionInterview[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/interviews`));
      if (!res.ok) throw new Error(await extractError(res));
      const interviews = await res.json();

      if (!titles || titles.length === 0) {
        return interviews;
      }

      const titleOrderMap = new Map(titles.map((t, index) => [t.id, index]));

      return interviews.sort((a: ProductionInterview, b: ProductionInterview) => {
        const indexA = a.titleDefinitionId !== null ? titleOrderMap.get(a.titleDefinitionId) : undefined;
        const indexB = b.titleDefinitionId !== null ? titleOrderMap.get(b.titleDefinitionId) : undefined;

        if (indexA !== undefined && indexB !== undefined) {
          return indexA - indexB;
        }
        if (indexA !== undefined) {
          return -1;
        }
        if (indexB !== undefined) {
          return 1;
        }
        return 0;
      });
    }
  });
}

export type CrewMember = {
  person: Person;
  positions: Position[];
};

export type CrewByCategory = Record<PositionCategory, CrewMember[]>;


export function useProductionCrew(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'crew'],
    enabled: !!productionId,
    queryFn: async (): Promise<CrewByCategory> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/crew`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    }
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions-catalog'],
    queryFn: async (): Promise<Position[]> => {
      const res = await fetch(createUrl('/api/production/positions'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useProductionDates() {
  return useQuery({
    queryKey: ['production', 'dates'],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch(createUrl('/api/reports/production-dates'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useNextProductionDate() {
  return useQuery({
    queryKey: ['production', 'next-date'],
    queryFn: async (): Promise<string> => {
      const res = await fetch(createUrl('/api/reports/next-production-date'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}
