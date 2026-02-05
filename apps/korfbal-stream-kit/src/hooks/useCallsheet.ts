import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type CrewReport = {
  segments: Array<{ id: number; naam: string; volgorde: number }>;
  positions: Array<{ id: number; name: string }>;
  cells: Array<{ segmentId: number; positionId: number; personName: string }>;
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
  productionSegmentId: number;
  cue: string;
  title: string;
  note?: string | null;
  color?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  durationSec: number;
  orderIndex: number;
  positionIds?: number[];
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
    mutationFn: async (input: CallSheetItem): Promise<CallSheetItem> => {
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
