import {logger} from "nx/src/utils/logger";

export type Sponsor = {
  id: number;
  name: string;
  type: 'premium' | 'goud' | 'zilver' | 'brons';
  logoUrl: string;
  websiteUrl: string;
  categories?: string | null;
  createdAt: string;
};

export type PlayerImage = { id: number; subject: string; filename: string; createdAt: string };

export type SponsorRow = { subject: string; image1: string; image2: string; image3: string };

export type SponsorInput = {
  name: string;
  type: Sponsor['type'];
  websiteUrl: string;
  logoUrl?: string;
};

export type SponsorUpdate = Partial<SponsorInput> & { id: number };

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

// -------- Settings: vMix Web URL --------
export type VmixSettings = { vmixWebUrl: string | null };

export async function getVmixSettings(): Promise<VmixSettings> {
  const url = new URL('/api/settings/vmix-url', API_BASE || window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load vMix settings: ${res.status}`);
  return res.json();
}

export async function setVmixSettings(vmixWebUrl: string): Promise<VmixSettings> {
  const url = new URL('/api/settings/vmix-url', API_BASE || window.location.origin);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vmixWebUrl }),
  });
  if (!res.ok) throw new Error(`Failed to save vMix settings: ${res.status}`);
  return res.json();
}

export async function vmixSetTimer(seconds: number): Promise<{ ok: boolean; seconds: number }>
{

  const url = new URL('/api/vmix/set-timer', API_BASE || window.location.origin);
  logger.info(`Setting vMix timer to ${JSON.stringify({ seconds: seconds })} seconds`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seconds: seconds }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to set timer: ${res.status} ${msg}`);
  }
  logger.info(res.statusText);
  return res.json();
}

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

export async function createSponsor(input: SponsorInput): Promise<Sponsor> {
  const url = new URL('/api/sponsors', API_BASE || window.location.origin);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create sponsor: ${res.status}`);
  return res.json();
}

export async function updateSponsor(id: number, input: Partial<SponsorInput>): Promise<Sponsor> {
  const url = new URL(`/api/sponsors/${id}`, API_BASE || window.location.origin);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update sponsor: ${res.status}`);
  return res.json();
}

export async function deleteSponsor(id: number): Promise<void> {
  const url = new URL(`/api/sponsors/${id}`, API_BASE || window.location.origin);
  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete sponsor: ${res.status}`);
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


export async function listPlayerImages(): Promise<{ items: PlayerImage[] }> {
  const url = new URL('/api/players/images', API_BASE || window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load player images: ${res.status}`);
  return res.json();
}

export async function uploadPlayerImage(subject: string | undefined, file: File): Promise<PlayerImage> {
  const url = new URL('/api/players/images', API_BASE || window.location.origin);
  const form = new FormData();
  if (subject && subject.trim() !== '') form.append('subject', subject);
  form.append('file', file, file.name);
  const res = await fetch(url.toString(), { method: 'POST', body: form as any });
  if (!res.ok) throw new Error(`Failed to upload player image: ${res.status}`);
  return res.json();
}

export async function deletePlayerImage(id: number): Promise<void> {
  const url = new URL(`/api/players/images/${id}`, API_BASE || window.location.origin);
  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete player image: ${res.status}`);
}

export async function generateSponsorRowsApi(sponsorIds?: number[]): Promise<SponsorRow[]> {
  const url = new URL('/api/vmix/sponsor-rows', API_BASE || window.location.origin);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sponsorIds }),
  });
  if (!res.ok) throw new Error(`Failed to generate sponsor rows: ${res.status}`);
  return res.json();
}
