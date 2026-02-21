import {logger} from "nx/src/utils/logger";

function getApiBaseUrl() {
  // In de browser is window.location.origin de base URL
  // In Docker is dit de nginx container zelf die de /api proxied naar de backend
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

export function createUrl(path: string): URL {
  const base = getApiBaseUrl();
  // Als path al met /api begint, gebruik dan alleen de base origin
  if (path.startsWith('/api')) {
    return new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  }
  // Als path met /uploads begint, gebruik dan de base origin (nginx proxied dit naar backend /storage)
  if (path.startsWith('/uploads')) {
    return new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  }
  // Als path met /storage begint, gebruik dan de base origin (nginx proxied dit naar backend /storage)
  if (path.startsWith('/storage')) {
    return new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  }
  return new URL(path, base);
}

export type Sponsor = {
  id: number;
  name: string;
  type: 'premium' | 'goud' | 'zilver' | 'brons';
  logoUrl: string;
  websiteUrl: string;
  categories?: string | null;
  displayName?: string | null;
  createdAt: string;
};

export type PlayerImage = { id: number; subject: string; filename: string; createdAt: string };

export type SponsorRow = { subject: string; image1: string; image2: string; image3: string };

export type SponsorInput = {
  name: string;
  type: Sponsor['type'];
  websiteUrl: string;
  logoUrl?: string;
  displayName?: string;
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

export type MatchSchedule = {
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

// -------- Settings: vMix Web URL --------
export type VmixSettings = { vmixWebUrl: string | null };

export async function getVmixSettings(): Promise<VmixSettings> {
  const url = createUrl('/api/settings/vmix-url');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load vMix settings: ${res.status}`);
  return res.json();
}

export async function setVmixSettings(vmixWebUrl: string): Promise<VmixSettings> {
  const url = createUrl('/api/settings/vmix-url');
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({vmixWebUrl}),
  });
  if (!res.ok) throw new Error(`Failed to save vMix settings: ${res.status}`);
  return res.json();
}

export async function vmixSetTimer(seconds: number): Promise<{ ok: boolean; seconds: number }> {

  const url = createUrl('/api/vmix/set-timer');
  logger.info(`Setting vMix timer to ${JSON.stringify({seconds: seconds})} seconds`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({seconds: seconds}),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to set timer: ${res.status} ${msg}`);
  }
  logger.info(res.statusText);
  return res.json();
}

export async function fetchSponsors(params: {
  type?: Sponsor['type'] | Sponsor['type'][];
  page?: number;
  limit?: number
} = {}): Promise<Paginated<Sponsor>> {
  const url = createUrl('/api/sponsors');
  logger.info(`Fetching sponsors: ${url}`);
  if (params.type) {
    if (Array.isArray(params.type)) {
      params.type.forEach(t => url.searchParams.append('type', t));
    } else {
      url.searchParams.set('type', params.type);
    }
  }
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load sponsors: ${res.status}`);
  }
  return res.json();
}

export async function createSponsor(input: SponsorInput): Promise<Sponsor> {
  const url = createUrl('/api/sponsors');
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create sponsor: ${res.status}`);
  return res.json();
}

export async function updateSponsor(id: number, input: Partial<SponsorInput>): Promise<Sponsor> {
  const url = createUrl(`/api/sponsors/${id}`);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update sponsor: ${res.status}`);
  return res.json();
}

export async function deleteSponsor(id: number): Promise<void> {
  const url = createUrl(`/api/sponsors/${id}`);
  const res = await fetch(url.toString(), {method: 'DELETE'});
  if (!res.ok) throw new Error(`Failed to delete sponsor: ${res.status}`);
}

export async function uploadSponsorsExcel(file: File): Promise<any> {
  const url = createUrl('/api/sponsors/upload-excel');
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(url.toString(), {method: 'POST', body: form as any});
  if (!res.ok) throw new Error(`Failed to upload sponsors: ${res.status}`);
  return res.json();
}

export async function fetchScoreboard(): Promise<ScoreboardItem[]> {
  const url = createUrl('/api/scoreboard');
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load scoreboard: ${res.status}`);
  }
  return res.json();
}

export async function fetchShotclock(): Promise<ShotclockItem[]> {
  const url = createUrl('/api/scoreboard/shotclock');
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load shotclock: ${res.status}`);
  }
  return res.json();
}

export async function fetchMatchClock(): Promise<MatchClockItem[]> {
  const url = createUrl('/api/scoreboard/clock');
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load match clock: ${res.status}`);
  }
  return res.json();
}

export async function fetchMatchSchedule(params: { date: string; location?: 'HOME' | 'AWAY' | 'ALL' }): Promise<{
  items: MatchSchedule[];
  count: number;
  date: string
}> {
  // Legacy alias: now served by match schedule endpoint
  const url = createUrl('/api/match/matches/schedule');

  url.searchParams.set('date', params.date);
  if (params.location) url.searchParams.set('location', params.location);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load match schedule: ${res.status}`);
  }
  return res.json();
}

export async function importMatchSchedule(params?: { date?: string; location?: 'HOME' | 'AWAY' | 'ALL' }) {
  const url = createUrl('/api/match/matches/schedule/import');
  if (params?.date) url.searchParams.set('date', params.date);
  if (params?.location) url.searchParams.set('location', params.location);

  const res = await fetch(url.toString(), {method: 'POST'});
  if (!res.ok) {
    throw new Error(`Failed to import match schedule: ${res.status}`);
  }
  return res.json();
}


export async function listPlayerImages(): Promise<{ items: PlayerImage[] }> {
  const url = createUrl('/api/players/images');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load player images: ${res.status}`);
  return res.json();
}

export async function uploadPlayerImage(subject: string | undefined, file: File): Promise<PlayerImage> {
  const url = createUrl('/api/players/images');
  const form = new FormData();
  if (subject && subject.trim() !== '') form.append('subject', subject);
  form.append('file', file, file.name);
  const res = await fetch(url.toString(), {method: 'POST', body: form as any});
  if (!res.ok) throw new Error(`Failed to upload player image: ${res.status}`);
  return res.json();
}

export async function deletePlayerImage(id: number): Promise<void> {
  const url = createUrl(`/api/players/images/${id}`);
  const res = await fetch(url.toString(), {method: 'DELETE'});
  if (!res.ok) throw new Error(`Failed to delete player image: ${res.status}`);
}

export async function generateSponsorRowsApi(sponsorIds?: number[]): Promise<SponsorRow[]> {
  const url = createUrl('/api/vmix/sponsor-rows');
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({sponsorIds}),
  });
  if (!res.ok) throw new Error(`Failed to generate sponsor rows: ${res.status}`);
  return res.json();
}

export async function extractError(res: Response): Promise<string> {
  try {
    const ct = res?.headers?.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body: any = await res.json().catch(() => ({}));
      if (body && (body.error || body.message)) return String(body.error || body.message);
    } else if (res.bodyUsed) {
      return await res.text()
    } else {
      return res.statusText;
    }
  } catch (e) {
    logger.error(`Failed to extract error from response: ${JSON.stringify(res)}\n${e}`);
  }
  return `Request failed (${res.status})`;
}

export async function getSponsorConfig(): Promise<{ namesTypes: string[]; rowsTypes: string[]; slidesTypes: string[] }> {
  const url = createUrl('/api/settings/sponsor-config');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load sponsor config: ${res.status}`);
  return res.json();
}

export async function setSponsorConfig(config: { namesTypes: string[]; rowsTypes: string[]; slidesTypes: string[] }): Promise<void> {
  const url = createUrl('/api/settings/sponsor-config');
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to save sponsor config: ${res.status}`);
}

export async function getScoreboardConfig(): Promise<{ scoreboardUrl: string | null; shotclockUrl: string | null }> {
  const url = createUrl('/api/settings/scoreboard-config');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load scoreboard config: ${res.status}`);
  return res.json();
}

export async function setScoreboardConfig(config: { scoreboardUrl: string; shotclockUrl: string }): Promise<void> {
  const url = createUrl('/api/settings/scoreboard-config');
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to save scoreboard config: ${res.status}`);
}
