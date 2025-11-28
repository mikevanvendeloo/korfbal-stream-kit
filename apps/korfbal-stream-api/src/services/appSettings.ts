import { prisma } from './prisma';
import { z } from 'zod';

// Simple in-memory cache for settings to reduce DB hits during a process lifetime
const cache = new Map<string, string>();

export async function getSetting(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return null;
  cache.set(key, row.value);
  return row.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  cache.set(key, value);
}

export const VmixUrlSchema = z.string().url();

export const VMIX_URL_KEY = 'vmixWebUrl';

export async function getVmixUrl(): Promise<string | null> {
  return getSetting(VMIX_URL_KEY);
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
