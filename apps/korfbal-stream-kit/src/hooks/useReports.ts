import {useQuery} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';

export type DailyOccupancyReport = {
  date: string;
  productions: Array<{
    id: number;
    time: string;
    homeTeam: string;
    awayTeam: string;
  }>;
  persons: Array<{
    id: number;
    name: string;
    assignments: Record<number, string[]>;
  }>;
};

export type InterviewsReport = Array<{
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeInterviews: Array<{ name: string; role: string; photoUrl?: string }>;
  awayInterviews: Array<{ name: string; role: string; photoUrl?: string }>;
}>;

export type CrewRolesReport = Array<{
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  speaker: string[];
  regisseur: string[];
  presentator: string[];
  analist: string[];
}>;

export function useDailyOccupancyReport(date: string) {
  return useQuery({
    queryKey: ['reports', 'daily-occupancy', date],
    enabled: !!date,
    queryFn: async (): Promise<DailyOccupancyReport> => {
      const res = await fetch(createUrl(`/api/reports/daily-occupancy?date=${date}`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useInterviewsReport() {
  return useQuery({
    queryKey: ['reports', 'interviews'],
    queryFn: async (): Promise<InterviewsReport> => {
      const res = await fetch(createUrl('/api/reports/interviews'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCrewRolesReport() {
  return useQuery({
    queryKey: ['reports', 'crew-roles'],
    queryFn: async (): Promise<CrewRolesReport> => {
      const res = await fetch(createUrl('/api/reports/crew-roles'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}
