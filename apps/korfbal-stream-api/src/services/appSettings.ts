import { prisma } from './prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Simple in-memory cache for settings to reduce DB hits during a process lifetime
const cache = new Map<string, any>();

export async function getSetting<T>(key: string): Promise<T | null> {
  if (cache.has(key)) return cache.get(key)!;
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row || !row.value) return null;
  cache.set(key, row.value);
  return row.value as T;
}

export async function setSetting(key: string, value: Prisma.JsonValue): Promise<void> {
  // Prisma requires the explicit `Prisma.JsonNull` enum to set a JSON field to null.
  const valueForDb = value === null ? Prisma.JsonNull : value;
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: valueForDb },
    update: { value: valueForDb },
  });
  cache.set(key, value); // Cache the original value (e.g., JavaScript null)
}

export const VmixUrlSchema = z.string().url();

export const VMIX_URL_KEY = 'vmixWebUrl';
export const SPONSOR_NAMES_TYPES_KEY = 'sponsorNamesTypes';
export const SPONSOR_ROWS_TYPES_KEY = 'sponsorRowsTypes';
export const SPONSOR_SLIDES_TYPES_KEY = 'sponsorSlidesTypes';
export const SCOREBOARD_URL_KEY = 'scoreboardUrl';
export const SHOTCLOCK_URL_KEY = 'shotclockUrl';
export const OWN_CLUB_ID_KEY = 'ownClubId';
export const PRODUCTION_TEAM_NAMES_KEY = 'productionTeamNames';

export async function getVmixUrl(): Promise<string | null> {
  return getSetting<string>(VMIX_URL_KEY);
}

export async function setVmixUrl(input: string): Promise<void> {
  const parsed = VmixUrlSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Invalid URL for vMix Web URL');
  }
  await setSetting(VMIX_URL_KEY, parsed.data);
}

export function buildVmixApiUrl(base: string, query: string): string {
  const root = (base || '').replace(/\/$/, '');
  // vMix expects /api (case-insensitive), we normalize to /api
  const hasApi = /\/api\/?$/i.test(root);
  const baseUrl = hasApi ? root : root + '/api';
  if (query.startsWith('?')) return baseUrl + query;
  return baseUrl + '?' + query;
}

export async function getSponsorNamesTypes(): Promise<string[]> {
  const val = await getSetting<string[]>(SPONSOR_NAMES_TYPES_KEY);
  return val || ['premium', 'goud', 'zilver']; // default
}

export async function setSponsorNamesTypes(types: string[]): Promise<void> {
  await setSetting(SPONSOR_NAMES_TYPES_KEY, types);
}

export async function getSponsorRowsTypes(): Promise<string[]> {
  const val = await getSetting<string[]>(SPONSOR_ROWS_TYPES_KEY);
  return val || ['premium', 'goud', 'zilver']; // default
}

export async function setSponsorRowsTypes(types: string[]): Promise<void> {
  await setSetting(SPONSOR_ROWS_TYPES_KEY, types);
}

export async function getSponsorSlidesTypes(): Promise<string[]> {
  const val = await getSetting<string[]>(SPONSOR_SLIDES_TYPES_KEY);
  return val || ['premium', 'goud', 'zilver']; // default
}

export async function setSponsorSlidesTypes(types: string[]): Promise<void> {
  await setSetting(SPONSOR_SLIDES_TYPES_KEY, types);
}

export async function getScoreboardUrl(): Promise<string | null> {
  return getSetting<string>(SCOREBOARD_URL_KEY);
}

export async function setScoreboardUrl(input: string): Promise<void> {
  await setSetting(SCOREBOARD_URL_KEY, input);
}

export async function getShotclockUrl(): Promise<string | null> {
  return getSetting<string>(SHOTCLOCK_URL_KEY);
}

export async function setShotclockUrl(input: string): Promise<void> {
  await setSetting(SHOTCLOCK_URL_KEY, input);
}
