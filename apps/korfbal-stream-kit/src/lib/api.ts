export type Sponsor = {
  id: number;
  name: string;
  type: 'premium' | 'goud' | 'zilver' | 'brons';
  logoUrl: string;
  websiteUrl: string;
  categories?: string | null;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ScoreboardItem = { status: string; home: number; guest: number };
export type ShotclockItem = { status: string; time: number; color?: 'green' | 'orange' | 'red' };
export type MatchClockItem = { status: string; minute: string; second: string; period: 0 | 1 | 2 };

export type ProgramMatch = {
  id: number;
  externalId: string;
  date: string; // ISO
  homeTeamName: string;
  awayTeamName: string;
  accommodationName?: string | null;
  accommodationRoute?: string | null;
  attendanceTime?: string | null;
  isPracticeMatch: boolean;
  isHomeMatch: boolean;
  isCompetitiveMatch: boolean;
  fieldName?: string | null;
  refereeName?: string | null;
  reserveRefereeName?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  color?: string | null;
};

// New alias using matchSchedule terminology
export type MatchSchedule = ProgramMatch;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export async function fetchSponsors(params: { type?: Sponsor['type']; page?: number; limit?: number } = {}): Promise<Paginated<Sponsor>> {
  const url = new URL('/api/sponsors', API_BASE || window.location.origin);
  if (params.type) url.searchParams.set('type', params.type);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load sponsors: ${res.status}`);
  }
  return res.json();
}

export async function uploadSponsorsExcel(file: File): Promise<any> {
  const url = new URL('/api/sponsors/upload-excel', API_BASE || window.location.origin);
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(url.toString(), { method: 'POST', body: form as any });
  if (!res.ok) throw new Error(`Failed to upload sponsors: ${res.status}`);
  return res.json();
}

export async function fetchScoreboard(): Promise<ScoreboardItem[]> {
  const url = new URL('/api/scoreboard', API_BASE || window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load scoreboard: ${res.status}`);
  }
  return res.json();
}

export async function fetchShotclock(): Promise<ShotclockItem[]> {
  const url = new URL('/api/scoreboard/shotclock', API_BASE || window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load shotclock: ${res.status}`);
  }
  return res.json();
}

export async function fetchMatchClock(): Promise<MatchClockItem[]> {
  const url = new URL('/api/scoreboard/clock', API_BASE || window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load match clock: ${res.status}`);
  }
  return res.json();
}

export async function fetchProgram(params: { date: string; location?: 'HOME' | 'AWAY' | 'ALL' }): Promise<{ items: ProgramMatch[]; count: number; date: string }> {
  // Legacy alias: now served by match schedule endpoint
  const url = new URL('/api/match/matches/schedule', API_BASE || window.location.origin);
  url.searchParams.set('date', params.date);
  if (params.location) url.searchParams.set('location', params.location);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load match schedule: ${res.status}`);
  }
  return res.json();
}

// New function using matchSchedule terminology
export async function fetchMatchSchedule(params: { date: string; location?: 'HOME' | 'AWAY' | 'ALL' }): Promise<{ items: MatchSchedule[]; count: number; date: string }> {
  // Reuse the same backend endpoint
  const res = await fetchProgram(params);
  // Type-wise it's the same shape; just return as-is
  return res as any;
}

export async function importMatchSchedule(params?: { date?: string; location?: 'HOME' | 'AWAY' | 'ALL' }) {
  const url = new URL('/api/match/matches/schedule/import', API_BASE || window.location.origin);
  if (params?.date) url.searchParams.set('date', params.date);
  if (params?.location) url.searchParams.set('location', params.location);

  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to import match schedule: ${res.status}`);
  }
  return res.json();
}
