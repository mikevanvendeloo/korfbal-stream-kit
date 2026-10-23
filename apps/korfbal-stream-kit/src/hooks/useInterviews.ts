import {useEffect} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";
import {getSharedSocket} from '../lib/socket';

export type InterviewRole = 'PLAYER' | 'COACH';
export type InterviewSide = 'HOME' | 'AWAY' | 'NONE';

export type InterviewSubject = {
  id: number;
  productionId: number;
  side: InterviewSide;
  role: InterviewRole;
  playerId: number;
  titleDefinitionId: number | null;
  player?: { id: number; name: string; function?: string | null, photoUrl?: string | null };
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

/** Socket event from the API after the interview choice of a production changed; payload {productionId}. */
export const INTERVIEWS_UPDATED_EVENT = 'interviews_updated';

/**
 * Refetches the interview queries of a production as soon as its choice changes on another device
 * (the queries poll as well, in case the socket is down).
 */
export function useInterviewsUpdatedRefresh(productionId: number | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!productionId) return;
    // The app-wide socket: only this handler is removed on unmount
    const socket = getSharedSocket();
    const onUpdated = (payload: { productionId?: number } | undefined) => {
      if (payload?.productionId === productionId) void qc.invalidateQueries({queryKey: ['production', productionId, 'interviews']});
    };
    socket.on(INTERVIEWS_UPDATED_EVENT, onUpdated);
    return () => {
      socket.off(INTERVIEWS_UPDATED_EVENT, onUpdated);
    };
  }, [qc, productionId]);
}

/** One chosen interview as the LIVE Interviews screen shows it. */
export type InterviewCard = {
  id: number;
  side: InterviewSide;
  role: InterviewRole;
  /** Name of the vMix title it is chosen for, if any */
  title: string | null;
  name: string;
  shirtNo: number | null;
  photoUrl: string | null;
  teamName: string | null;
};

export function useInterviewCards(productionId: number | undefined) {
  useInterviewsUpdatedRefresh(productionId);
  return useQuery({
    queryKey: ['production', productionId, 'interviews', 'cards'],
    enabled: !!productionId,
    queryFn: async (): Promise<InterviewCard[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/interview-cards`));
      if (!res.ok) throw new Error(await extractError(res));
      return (await res.json()).items;
    },
    // Like the callsheet's names: the choice can change on another device during the show
    refetchInterval: 10_000,
  });
}
