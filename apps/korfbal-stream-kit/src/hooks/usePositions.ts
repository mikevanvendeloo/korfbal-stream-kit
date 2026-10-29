import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export enum PositionCategory {
  GENERAL = 'GENERAL',
  TECHNICAL = 'TECHNICAL',
  ENTERTAINMENT = 'ENTERTAINMENT',
}

export type Position = {
  id: number;
  name: string;
  skill?: { id: number; code: string; name: string } | null;
  category: PositionCategory;
  sortOrder: number;
  linkedPositions?: Array<{ targetPosition: Position }>;
  linkedToPositions?: Array<{ sourcePosition: Position }>;
};

export function usePositionsCatalog() {
  return useQuery({
    queryKey: ['positions-catalog'],
    queryFn: async (): Promise<Position[]> => {
      const res = await fetch(createUrl('/api/production/positions'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; skillId?: number | null; category?: PositionCategory; sortOrder?: number }): Promise<Position> => {
      const res = await fetch(createUrl('/api/production/positions'), {
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
    mutationFn: async (input: { id: number; name?: string; skillId?: number | null; category?: PositionCategory; sortOrder?: number }): Promise<Position> => {
      const res = await fetch(createUrl(`/api/production/positions/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.name, skillId: input.skillId, category: input.category, sortOrder: input.sortOrder }),
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
      const res = await fetch(createUrl(`/api/production/positions/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions-catalog'] }),
  });
}
