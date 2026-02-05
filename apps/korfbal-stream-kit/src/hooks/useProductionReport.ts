import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type ProductionReport = {
  id: number;
  productionId: number;
  matchSponsor?: string | null;
  interviewRationale?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Sponsor = {
  id: number;
  name: string;
  type: string;
  logoUrl: string;
  websiteUrl: string;
};

export type InterviewPerson = {
  id: number;
  name: string;
  shirtNo?: number | null;
  function?: string | null;
  photoUrl?: string | null;
};

export type ProductionReportData = {
  production: {
    id: number;
    matchScheduleId: number;
    homeTeam: string;
    awayTeam: string;
    date: string;
  };
  report: ProductionReport | null;
  enriched: {
    attendees: string[];
    rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>>;
    interviews: {
      home: {
        players: InterviewPerson[];
        coaches: InterviewPerson[];
      };
      away: {
        players: InterviewPerson[];
        coaches: InterviewPerson[];
      };
    };
  };
  sponsors: Sponsor[];
};

export function useProductionReport(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'report'],
    enabled: !!productionId,
    queryFn: async (): Promise<ProductionReportData> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/report`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveProductionReport(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      matchSponsor?: string | null;
      interviewRationale?: string | null;
    }): Promise<ProductionReport> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/report`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'report'] }),
  });
}

export function useDeleteProductionReport(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(createUrl(`/api/production/${productionId}/report`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production', productionId, 'report'] }),
  });
}

export function getProductionReportPdfUrl(productionId: number): string {
  return `/api/production/${productionId}/report/pdf`;
}

export function getProductionReportMarkdownUrl(productionId: number): string {
  return `/api/production/${productionId}/report/markdown`;
}

export function getProductionReportWhatsappUrl(productionId: number): string {
  return `/api/production/${productionId}/report/whatsapp`;
}
