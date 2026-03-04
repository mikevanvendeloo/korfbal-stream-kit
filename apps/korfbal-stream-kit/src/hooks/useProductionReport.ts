import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';
import {PositionCategory} from './usePositions';

export type ProductionReportData = {
  production: {
    id: number;
    matchScheduleId: number;
    homeTeam: string;
    awayTeam: string;
    date: string;
    liveTime?: string | null;
  };
  report: {
    matchSponsor?: string | null;
    interviewRationale?: string | null;
    remarks?: string | null;
  } | null;
  enriched: {
    attendees: { name: string; isAssigned: boolean }[];
    crewByCategory: Record<PositionCategory, { positionName: string; personNames: string[] }[]>;
    interviews: {
      home: { players: any[]; coaches: any[] };
      away: { players: any[]; coaches: any[] };
    };
  };
  sponsors: { id: number; name: string }[];
};

export function useProductionReport(productionId: number) {
  return useQuery<ProductionReportData>({
    queryKey: ['production', productionId, 'report'],
    enabled: !!productionId,
    queryFn: async () => {
      const res = await fetch(createUrl(`/api/production/${productionId}/report`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveProductionReport(productionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { matchSponsor: string | null; interviewRationale: string | null; remarks: string | null }) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/report`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', productionId, 'report'] });
    },
  });
}

export const getProductionReportPdfUrl = (productionId: number) => createUrl(`/api/production/${productionId}/report/pdf`);
export const getProductionReportMarkdownUrl = (productionId: number) => createUrl(`/api/production/${productionId}/report/markdown`);
export const getProductionReportWhatsappUrl = (productionId: number) => createUrl(`/api/production/${productionId}/report/whatsapp`);
