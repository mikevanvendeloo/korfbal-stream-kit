import {createHash, randomBytes} from 'node:crypto';
import type {Organization, OrganizationApiKey} from '@prisma/client';
import {prisma, prismaUnscoped} from './prisma';
import {logger} from '../utils/logger';

/**
 * API keys of an organization (D7): vMix data sources and other devices can't send X-Organization, so
 * they send a key (`?key=` or `X-Api-Key`) on the feed routes. Only the SHA-256 hash is stored; the key
 * itself is shown once, when it is created.
 */
export const API_KEY_PREFIX = 'sk_';
const KEY_BYTES = 32;
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 6;
/** `lastUsedAt` is written at most this often per key, not on every vMix poll. */
export const LAST_USED_WRITE_INTERVAL_MS = 60_000;
/** Longest value worth hashing: a real key is 46 characters. */
const MAX_KEY_LENGTH = 200;

export type ApiKeyDto = Pick<OrganizationApiKey, 'id' | 'name' | 'prefix' | 'createdAt' | 'lastUsedAt' | 'revokedAt'>;

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
}

export function toApiKeyDto({id, name, prefix, createdAt, lastUsedAt, revokedAt}: OrganizationApiKey): ApiKeyDto {
  return {id, name, prefix, createdAt, lastUsedAt, revokedAt};
}

/** Creates a key for the organization in the context. The full key is in the result only this once. */
export async function createApiKey(name: string): Promise<ApiKeyDto & {key: string}> {
  const key = generateApiKey();
  const row = await prisma.organizationApiKey.create({
    data: {name, keyHash: hashApiKey(key), prefix: key.slice(0, DISPLAY_PREFIX_LENGTH)},
  });
  return {...toApiKeyDto(row), key};
}

export async function listApiKeys(): Promise<ApiKeyDto[]> {
  const rows = await prisma.organizationApiKey.findMany({orderBy: [{revokedAt: {sort: 'desc', nulls: 'first'}}, {createdAt: 'desc'}]});
  return rows.map(toApiKeyDto);
}

/** Revokes a key of the organization in the context; null when it has no such key. Revoking twice keeps the first date. */
export async function revokeApiKey(id: number): Promise<ApiKeyDto | null> {
  const row = await prisma.organizationApiKey.findUnique({where: {id}});
  if (!row) return null;
  if (row.revokedAt) return toApiKeyDto(row);
  return toApiKeyDto(await prisma.organizationApiKey.update({where: {id}, data: {revokedAt: new Date()}}));
}

/**
 * The organization a key belongs to: null for an unknown or revoked key (looked up by its hash, so
 * there is no comparison to time). The key's organization may still be inactive: the caller checks.
 */
export async function findOrganizationByApiKey(key: string, now = new Date()): Promise<Organization | null> {
  if (!key.startsWith(API_KEY_PREFIX) || key.length > MAX_KEY_LENGTH) return null;
  // Before a request has an organization: the lookup itself is what finds it
  const row = await prismaUnscoped.organizationApiKey.findUnique({
    where: {keyHash: hashApiKey(key)},
    include: {organization: true},
  });
  if (!row || row.revokedAt) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() >= LAST_USED_WRITE_INTERVAL_MS) {
    prismaUnscoped.organizationApiKey.update({where: {id: row.id}, data: {lastUsedAt: now}})
      .catch((err: unknown) => logger.warn('Updating lastUsedAt of an API key failed', {id: row.id, error: (err as Error)?.message}));
  }
  return row.organization;
}
