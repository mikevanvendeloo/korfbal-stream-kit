import {QueryClient, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';
import {Position, PositionCategory} from "./usePositions";
import {Person} from "./usePersons";
import {useProductionTitles} from "./useTitles";

/**
 * After a match changed (manual edit or match import): the productions list shows the match's date
 * and teams, and the server moved the production's own times along (services/matchChange.ts).
 * ['production'] covers a production's detail, timing, callsheet and the match choice.
 */
export function invalidateMatchDependents(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({queryKey: ['manual-matches']}),
    qc.invalidateQueries({queryKey: ['productions']}),
    qc.invalidateQueries({queryKey: ['production']}),
  ]);
}

export type Production = {
  id: number;
  matchScheduleId: number;
  isActive: boolean;
  liveTime?: string;
  /** Own opbouw / verzamel time; null = the organization's default (see `planned`) */
  setupTime?: string | null;
  crewCallTime?: string | null;
  /** Hoofdstukken placed by the segment migration and not yet checked (openspec/changes/chapters D7) */
  chaptersAutoPlaced?: boolean;
  /** Only on a single production (GET /api/production/:id and /active): the times as they count */
  planned?: PlannedTimes | null;
  /** Only on /api/production/active: the end of the livestream (latest item end) */
  liveEnd?: string | null;
  callSheetTemplateId?: number | null;
  /** Only in the list (GET /api/production): the minimum staffing of the people present */
  staffing?: StaffingSummary;
  matchSchedule?: {
    id: number;
    homeTeamName: string;
    awayTeamName: string;
    date: string;
  }
};

/** The day planning of one production (services/dayPlanning.ts in the API). */
export type PlannedTimes = {
  liveStart: string;
  crewCallTime: string;
  crewCallIsDefault: boolean;
  /** Opbouw counts only for the day's first stream */
  isFirstOfDay: boolean;
  setupTime: string | null;
  setupIsDefault: boolean;
};

/** A hoofdstuk of the production's draaiboek (GET /api/production/:id/chapters, in order). */
export type ProductionChapter = {
  id: number;
  productionId: number;
  name: string;
  orderIndex: number;
};

/** A hoofdstuk with its times, derived from its items (null without timed items). */
export type ProductionTiming = {
  id: number;
  name: string;
  orderIndex: number;
  durationMinutes: number;
  start: string | null;
  end: string | null;
}

/** A standard position of a hoofdstuk (from the production's draaiboek template, else the standard list). */
export type ChapterStandardPosition = {
  id: number;
  name: string;
  order: number;
  requiredSkillCode: string | null;
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

/** A person in a position for one hoofdstuk only (an afwijking on the production-wide positions). */
export type ChapterAssignment = {
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

/** The production LIVE follows, independent of the active season. */
export function useActiveProduction() {
  return useQuery({
    queryKey: ['productions', 'active'],
    queryFn: async (): Promise<Production | null> => {
      const res = await fetch(createUrl('/api/production/active'));
      if (!res.ok) throw new Error(await extractError(res));
      return (await res.json()).item;
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
    mutationFn: async (input: { id: number; matchScheduleId?: number; liveTime?: string | null; setupTime?: string | null; crewCallTime?: string | null }): Promise<Production> => {
      const {id, ...body} = input;
      const res = await fetch(createUrl(`/api/production/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productions'] });
      // A changed live time also moves the default opbouw of the other productions of that day
      qc.invalidateQueries({ queryKey: ['production'] });
      qc.invalidateQueries({ queryKey: ['reports', 'daily-occupancy'] });
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

export function useProductionChapters(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'chapters'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionChapter[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/chapters`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
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

export type AttendanceGroup = 'crew' | 'entertainment';

export type AttendancePerson = {
  id: number;
  name: string;
  gender: 'male' | 'female';
  /** Entertainment when all skills belong to Entertainment positions; everyone else is Crew (API: domain/crewGroup.ts) */
  group: AttendanceGroup;
  skills: Array<{ code: string; name: string }>;
  /** Set when the person is marked present */
  productionPersonId: number | null;
};

/** One role of the minimum staffing (API: domain/minimumStaffing.ts, where the counts and skill codes live) */
export type StaffingRole = {
  key: string;
  label: string;
  singular: string;
  plural: string;
  required: number;
  optional: boolean;
  skillCodes: string[];
  filled: number;
  personIds: number[];
  unknownSkillCodes: string[];
  met: boolean;
};

export type Staffing = {
  roles: StaffingRole[];
  met: boolean;
  shortfall: Array<{ key: string; missing: number; singular: string; plural: string }>;
};

export type ProductionAttendance = { persons: AttendancePerson[]; staffing: Staffing };

/** The minimum staffing per production in the productions list (API: services/productionStaffing.ts) */
export type StaffingSummary = {
  presentCount: number;
  met: boolean;
  shortfall: Staffing['shortfall'];
  roles: Array<Pick<StaffingRole, 'key' | 'label' | 'required' | 'filled' | 'optional' | 'met'>>;
};

function invalidateAttendance(qc: QueryClient, productionId: number) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['production', productionId, 'persons'] }),
    qc.invalidateQueries({ queryKey: ['production', productionId, 'attendance'] }),
    // The Bezetting column of the productions list
    qc.invalidateQueries({ queryKey: ['productions'] }),
  ]);
}

/** Beschikbaarheid: every person (no paging) with group, skills and presence, plus the minimum staffing. */
export function useProductionAttendance(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'attendance'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionAttendance> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/attendance`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
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
    onSuccess: () => invalidateAttendance(qc, productionId),
  });
}

export function useDeleteProductionPerson(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/persons/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => invalidateAttendance(qc, productionId),
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

// Bezetting per hoofdstuk. The API keeps the paths /api/production/segments/:segmentId/... (a segment is a hoofdstuk now).
const chapterAssignmentsKey = (chapterId: number) => ['production', 'chapters', chapterId, 'assignments'];

export function useChapterAssignments(chapterId: number) {
  return useQuery({
    queryKey: chapterAssignmentsKey(chapterId),
    enabled: !!chapterId,
    queryFn: async (): Promise<ChapterAssignment[]> => {
      const res = await fetch(createUrl(`/api/production/segments/${chapterId}/assignments`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useAddChapterAssignment(chapterId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number, positionId: number }): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segments/${chapterId}/assignments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chapterAssignmentsKey(chapterId) }),
  });
}

export function useDeleteChapterAssignment(chapterId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/segments/${chapterId}/assignments/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chapterAssignmentsKey(chapterId) }),
  });
}

export function useCopyChapterAssignments(chapterId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetChapterIds: number[], mode: 'merge' | 'overwrite' }): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segments/${chapterId}/assignments/copy`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSegmentIds: input.targetChapterIds, mode: input.mode }),
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: (_data, vars) => {
      vars.targetChapterIds.forEach(id => {
        qc.invalidateQueries({ queryKey: chapterAssignmentsKey(id) });
      });
    },
  });
}

export function useChapterStandardPositions(chapterId: number) {
  return useQuery({
    queryKey: ['production', 'chapters', chapterId, 'standard-positions'],
    enabled: !!chapterId,
    queryFn: async (): Promise<ChapterStandardPosition[]> => {
      const res = await fetch(createUrl(`/api/production/segments/${chapterId}/positions`));
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
