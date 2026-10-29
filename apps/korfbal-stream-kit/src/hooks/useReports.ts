import {useQuery} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';

/** A production's place in the day planning (services/dayPlanning.ts); *IsDefault: the organization's default. */
export type DayPlanningTimes = {
  /** Only for the day's first stream */
  setupTime: string | null;
  setupIsDefault: boolean;
  crewCallTime: string;
  crewCallIsDefault: boolean;
  liveStart: string;
  /** null when no item of the draaiboek has a time */
  liveEnd: string | null;
};

export type DailyOccupancyReport = {
  date: string;
  productions: Array<{
    id: number;
    time: string;
    liveTime?: string;
    endLiveTime?: string;
    homeTeam: string;
    awayTeam: string;
    planning: DayPlanningTimes;
  }>;
  persons: Array<{
    id: number;
    name: string;
    assignments: Record<number, string[]>;
  }>;
};

export type DailyOccupancyByPositionReport = {
  date: string;
  productions: Array<{
    id: number;
    time: string;
    liveTime?: string;
    endLiveTime?: string;
    homeTeam: string;
    awayTeam: string;
  }>;
  positions: Array<{
    id: number;
    name: string;
    category: string;
    sortOrder: number;
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
  remarks?: string | null;
  matchSponsor?: string | null;
  ballSponsor?: string | null;
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

export function useDailyOccupancyByPositionReport(date: string) {
  return useQuery({
    queryKey: ['reports', 'daily-occupancy-by-position', date],
    enabled: !!date,
    queryFn: async (): Promise<DailyOccupancyByPositionReport> => {
      const res = await fetch(createUrl(`/api/reports/daily-occupancy-by-position?date=${date}`));
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

/** Who had which role per production of the season: a column per position of the report's categories. */
export type RolesReport = {
  positions: Array<{ id: number; name: string }>;
  productions: Array<{
    id: number;
    date: string;
    liveTime?: string | null;
    endLiveTime?: string | null;
    homeTeam: string;
    awayTeam: string;
    /** Names per position id */
    assignments: Record<number, string[]>;
  }>;
};

/** entertainment: the ENTERTAINMENT positions; crew: the TECHNICAL and GENERAL ones (regie, camera's, oplopen, ...). */
export function useRolesReport(kind: 'entertainment' | 'crew') {
  return useQuery({
    queryKey: ['reports', `${kind}-roles`],
    queryFn: async (): Promise<RolesReport> => {
      const res = await fetch(createUrl(`/api/reports/${kind}-roles`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}
