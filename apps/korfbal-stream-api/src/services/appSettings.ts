import { prisma } from './prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireOrganizationId } from './organizationContext';

/**
 * Settings live per organization (OrganizationSetting), except the installation-wide keys in
 * GLOBAL_SETTING_KEYS (Setting). Organization settings need an organization in the context.
 */
export const GLOBAL_SETTING_KEYS: ReadonlySet<string> = new Set(['activeSeasonId']);

// In-memory cache per organization + key ("global" for installation-wide keys)
const cache = new Map<string, any>();

function cacheKey(key: string): string {
  const scope = GLOBAL_SETTING_KEYS.has(key) ? 'global' : String(requireOrganizationId(`Setting "${key}"`));
  return `${scope}:${key}`;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const cached = cacheKey(key);
  if (cache.has(cached)) return cache.get(cached)!;
  const row = GLOBAL_SETTING_KEYS.has(key)
    ? await prisma.setting.findUnique({ where: { key } })
    : await prisma.organizationSetting.findFirst({ where: { key } });
  if (!row || !row.value) return null;
  cache.set(cached, row.value);
  return row.value as T;
}

export async function setSetting(key: string, value: Prisma.JsonValue): Promise<void> {
  const cached = cacheKey(key);
  // Prisma requires the explicit `Prisma.JsonNull` enum to set a JSON field to null.
  const valueForDb = value === null ? Prisma.JsonNull : value;
  if (GLOBAL_SETTING_KEYS.has(key)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: valueForDb },
      update: { value: valueForDb },
    });
  } else {
    const organizationId = requireOrganizationId();
    await prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { key, value: valueForDb },
      update: { value: valueForDb },
    });
  }
  cache.set(cached, value); // Cache the original value (e.g., JavaScript null)
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
/** Extra entry at the end of the sponsor carousel ({name, logoUrl, type, websiteUrl}); none when unset. */
export const SPONSOR_CAROUSEL_EXTRA_KEY = 'sponsorCarouselExtra';

/** The first vMix instance; services/vmixInstances.ts keeps it in step with the list of instances. */
export async function getVmixUrl(): Promise<string | null> {
  return getSetting<string>(VMIX_URL_KEY);
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

/** Drops cached settings (of every organization): only the given keys, or everything when no keys are passed. */
export function clearSettingsCache(keys?: Iterable<string>): void {
  if (!keys) {
    cache.clear();
    return;
  }
  const dropped = new Set(keys);
  for (const cached of [...cache.keys()]) {
    if (dropped.has(cached.slice(cached.indexOf(':') + 1))) cache.delete(cached);
  }
}
