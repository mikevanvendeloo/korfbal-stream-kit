import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiUrl as url } from '../config/env';

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

export type Position = { id: number; name: string; capability?: { id: number; code: string; functionName: string } | null };

export function usePositionsCatalog() {
  return useQuery({
    queryKey: ['positions-catalog'],
    queryFn: async (): Promise<Position[]> => {
      const res = await fetch(url('/api/production/positions'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; capabilityId?: number | null }): Promise<Position> => {
      const res = await fetch(url('/api/production/positions'), {
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
    mutationFn: async (input: { id: number; name?: string; capabilityId?: number | null }): Promise<Position> => {
      const res = await fetch(url(`/api/production/positions/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.name, capabilityId: input.capabilityId }),
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
      const res = await fetch(url(`/api/production/positions/${id}`), { method: 'DELETE' });
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
      const res = await fetch(url('/api/production/segment-default-positions/names'));
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
      const res = await fetch(url(`/api/production/segment-default-positions?${params.toString()}`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveSegmentDefaultPositions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { segmentName: string; positions: Array<{ positionId: number; order: number }> }): Promise<SegmentDefaultPosition[]> => {
      const res = await fetch(url('/api/production/segment-default-positions'), {
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
