import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type InterviewRole = 'PLAYER' | 'COACH';
export type InterviewSide = 'HOME' | 'AWAY' | 'NONE';

export type InterviewSubject = {
  id: number;
  productionId: number;
  side: InterviewSide;
  role: InterviewRole;
  playerId: number;
  titleDefinitionId: number | null;
  player?: { id: number; name: string; function?: string | null };
};

export function useInterviewSelections(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'interviews'],
    enabled: !!productionId,
    queryFn: async (): Promise<InterviewSubject[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/interviews`).toString());
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useInterviewOptions(productionId: number, side: InterviewSide, role: InterviewRole) {
  return useQuery({
    queryKey: ['production', productionId, 'interviews', 'options', side, role],
    enabled: !!productionId && !!side && !!role,
    queryFn: async (): Promise<{ items: Array<{ id: number; name: string; function?: string | null }> }> => {
      const params = new URLSearchParams({ side, role });
      const url = createUrl(`/api/production/${productionId}/interviews/options`);
      url.search = params.toString();
      const res = await fetch(url);
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveInterviewSelections(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ side: InterviewSide; role: InterviewRole; playerId: number; titleDefinitionId?: number | null }>) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/interviews`).toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, replaceAll: true }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'interviews'] });
      qc.invalidateQueries({ queryKey: ['vmix', 'production', productionId, 'titles'] });
    },
  });
}
