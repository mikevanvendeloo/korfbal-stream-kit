import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {extractError} from "../lib/api";

export type Position = { id: number; name: string; skill?: { id: number; code: string; name: string } | null };

export function usePositionsCatalog() {
  return useQuery({
    queryKey: ['positions-catalog'],
    queryFn: async (): Promise<Position[]> => {
      const res = await fetch('/api/production/positions');
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; skillId?: number | null }): Promise<Position> => {
      const res = await fetch('/api/production/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions-catalog'] }),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; name?: string; skillId?: number | null }): Promise<Position> => {
      const res = await fetch(`/api/production/positions/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.name, skillId: input.skillId }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions-catalog'] }),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/production/positions/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions-catalog'] }),
  });
}

export type SegmentDefaultPosition = { id: number; segmentName: string; positionId: number; order: number; position: Position };

export function useSegmentDefaultNames() {
  return useQuery({
    queryKey: ['segment-default-positions', 'names'],
    queryFn: async (): Promise<{ items: string[]; hasGlobal?: boolean }> => {
      const res = await fetch('/api/production/segment-default-positions/names');
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSegmentDefaultPositions(segmentName: string) {
  return useQuery({
    queryKey: ['segment-default-positions', segmentName],
    enabled: !!segmentName,
    queryFn: async (): Promise<SegmentDefaultPosition[]> => {
      // Support special UI label "Algemeen" mapped to API internal name "__GLOBAL__"
      const apiName = segmentName === 'Algemeen' ? '__GLOBAL__' : segmentName;
      const params = new URLSearchParams({ segmentName: apiName });
      const res = await fetch(`/api/production/segment-default-positions?${params.toString()}`);
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveSegmentDefaultPositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { segmentName: string; positions: Array<{ positionId: number; order: number }> }): Promise<SegmentDefaultPosition[]> => {
      const res = await fetch('/api/production/segment-default-positions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['segment-default-positions', vars.segmentName] }),
  });
}
