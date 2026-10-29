import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";
import {Position, PositionCategory} from "./usePositions";

export type CrewReport = {
  chapters: Array<{ id: number; name: string; orderIndex: number }>;
  groupedPositions: Array<{ category: PositionCategory, positions: Position[] }>;
  /** Effective crew per hoofdstuk: production-wide positions plus the ones for that hoofdstuk only. */
  cells: Array<{ chapterId: number; positionId: number; personName: string; type: 'chapter' | 'production' }>;
  callsheets: Array<CallSheet & { items: Array<CallSheetItem & { chapter: { name: string } | null; positionIds: number[] }> }>;
  productionEvents?: Array<{
    callSheetItemId?: string | null;
    actualStartTime?: string | null;
    plannedStartTime?: string | null;
    durationSec?: number | null;
    status?: string | null;
  }>;
  productionReport?: {
    remarks?: string | null;
    interviewRationale?: string | null;
    matchSponsor?: string | null;
  } | null;
}

export function useCrewReport(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'crew-report'],
    enabled: !!productionId,
    queryFn: async (): Promise<CrewReport> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/crew-report`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    }
  });
}

export type CallSheet = { id: number; productionId: number; name: string; color?: string | null };
export type CallSheetItem = {
  id: string;
  callSheetId: number;
  /** The hoofdstuk the item is in (every item has one) */
  chapterId?: number | null;
  cue: string;
  title: string;
  note?: string | null;
  color?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  durationSec: number;
  orderIndex: number;
  isInVenue?: boolean;
  isInLivestream?: boolean;
  isTimeAnchor?: boolean;
  anchorType?: string | null;
  autoAdvance?: boolean;
  parentId?: string | null;
  positionIds?: number[];
  /** As the API lists them (GET /callsheets/:id) */
  positions?: { positionId: number }[];
}

export function useCalculateCallSheetTimes(callSheetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean }> => {
      const res = await fetch(createUrl(`/api/production/callsheets/${callSheetId}/calculate-times`), { method: 'POST' });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', 'callsheets', callSheetId] })
  });
}

export function useSyncCallSheetToEvents(callSheetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean }> => {
      const res = await fetch(createUrl(`/api/production/callsheets/${callSheetId}/sync-to-events`), { method: 'POST' });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production'] });
    }
  });
}

export function useCallSheets(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'callsheets'],
    enabled: !!productionId,
    queryFn: async (): Promise<CallSheet[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/callsheets`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    }
  });
}

export function useCreateCallSheet(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string | null }): Promise<CallSheet> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/callsheets`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'callsheets'] })
  });
}

export function useUpdateCallSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; name?: string; color?: string | null }): Promise<CallSheet> => {
      const res = await fetch(createUrl(`/api/production/callsheets/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: input.name, color: input.color }) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['production', 'callsheets', vars.id] });
    }
  });
}

export function useDeleteCallSheet(productionId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/production/callsheets/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      if (productionId) qc.invalidateQueries({ queryKey: ['production', productionId, 'callsheets'] });
    }
  });
}

export function useCallSheet(callSheetId: number) {
  return useQuery({
    queryKey: ['production', 'callsheets', callSheetId],
    enabled: !!callSheetId,
    queryFn: async (): Promise<CallSheet & { items: CallSheetItem[] }> => {
      const res = await fetch(createUrl(`/api/production/callsheets/${callSheetId}`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    }
  });
}

export function useCreateCallSheetItem(callSheetId: number) {
  const qc = useQueryClient();
  return useMutation({
    // No id: the server chooses it (CallSheetItem ids are global over all organizations)
    mutationFn: async (input: Omit<CallSheetItem, 'id' | 'callSheetId'>): Promise<CallSheetItem> => {
      const res = await fetch(createUrl(`/api/production/callsheets/${callSheetId}/items`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', 'callsheets', callSheetId] })
  });
}

export function useUpdateCallSheetItem(callSheetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CallSheetItem> & { id: string }): Promise<CallSheetItem> => {
      const { id, ...rest } = input;
      const res = await fetch(createUrl(`/api/production/callsheet-items/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rest) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', 'callsheets', callSheetId] })
  });
}

export function useDeleteCallSheetItem(callSheetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(createUrl(`/api/production/callsheet-items/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', 'callsheets', callSheetId] })
  });
}

/** The answer of a draaiboek import: the number of items and the hoofdstukken it added. */
export type DraaiboekImportResult = { ok: boolean; items: number; newChapters: string[] };

/**
 * Importeer draaiboek: a JSON file (a production draaiboek or a draaiboek template export) replaces the
 * callsheet's items. Afterwards the callsheet, its hoofdstukken and the timing are fetched again.
 */
export function useImportDraaiboek(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({callSheetId, file}: { callSheetId: number; file: File }): Promise<DraaiboekImportResult> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(createUrl(`/api/production/callsheets/${callSheetId}/import-json`), {method: 'POST', body: formData});
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (_data, {callSheetId}) => Promise.all([
      qc.invalidateQueries({queryKey: ['production', 'callsheets', callSheetId]}),
      qc.invalidateQueries({queryKey: ['production', productionId]}),
    ]),
  });
}
