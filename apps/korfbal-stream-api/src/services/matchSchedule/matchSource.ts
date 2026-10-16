import type {MatchSource} from '@prisma/client';
import {prisma} from '../prisma';
import {requireOrganizationId, runWithOrganization} from '../organizationContext';
import {getSetting, PRODUCTION_TEAM_NAMES_KEY} from '../appSettings';
import {normalizeTeamNameForClubMatch} from '../../utils/clubs';
import {logger} from '../../utils/logger';
import type {MatchSourceInput} from '../../schemas/organization';
import {createMatchScheduleProvider} from './providerFactory';
import type {MatchScheduleProvider} from './MatchScheduleProvider';

export const DEFAULT_MATCH_SOURCE_BASE_URL = 'https://api.sportclubvrijwilligersmanagement.nl/v1';

export class MatchSourceNotConfiguredError extends Error {
  readonly status = 409;
  constructor() {
    super('Wedstrijdimport is niet ingesteld voor deze organisatie');
    this.name = 'MatchSourceNotConfiguredError';
  }
}

/** The match source as the API shows it: the token never leaves the server, only whether it is set. */
export function toMatchSourceDto(source: MatchSource | null) {
  if (!source) return {provider: 'vrijwilligers', baseUrl: DEFAULT_MATCH_SOURCE_BASE_URL, isEnabled: false, hasApiToken: false, configured: false, updatedAt: null};
  const {provider, baseUrl, isEnabled, apiToken, updatedAt} = source;
  return {provider, baseUrl, isEnabled, hasApiToken: !!apiToken, configured: true, updatedAt};
}

/** The match source of the organization in the context. */
export async function getMatchSource(): Promise<MatchSource | null> {
  return prisma.matchSource.findFirst();
}

/** Saves the match source; `apiToken` undefined keeps the stored token, null removes it. */
export async function saveMatchSource(input: MatchSourceInput): Promise<MatchSource> {
  const existing = await getMatchSource();
  const data = {
    provider: input.provider,
    baseUrl: input.baseUrl,
    ...(input.isEnabled !== undefined ? {isEnabled: input.isEnabled} : {}),
    ...(input.apiToken !== undefined ? {apiToken: input.apiToken} : {}),
  };
  return existing
    ? prisma.matchSource.update({where: {id: existing.id}, data})
    : prisma.matchSource.create({data});
}

/** Club names of the organization's own teams: its name and the production team names without the team number. */
export async function ownTeamPrefixes(): Promise<string[]> {
  const organization = await prisma.organization.findUnique({where: {id: requireOrganizationId()}});
  const teamNames = (await getSetting<string[]>(PRODUCTION_TEAM_NAMES_KEY)) ?? [];
  const prefixes = [...teamNames.map(normalizeTeamNameForClubMatch), organization?.name ?? ''];
  return [...new Set(prefixes.map((p) => p.trim()).filter(Boolean))];
}

/** The provider for the organization in the context; MatchSourceNotConfiguredError when there is none (or it is off). */
export async function getMatchScheduleProvider(): Promise<MatchScheduleProvider> {
  const source = await getMatchSource();
  if (!source || !source.isEnabled) throw new MatchSourceNotConfiguredError();
  return createMatchScheduleProvider({...source, teamPrefixes: await ownTeamPrefixes()});
}

/**
 * One-time move of the old MATCH_SCHEDULE_* env vars into Fortuna's match source: only when they
 * are set and Fortuna has no source yet. After that the env vars are no longer read.
 */
export async function copyMatchSourceFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const token = env.MATCH_SCHEDULE_API_TOKEN?.trim();
  const baseUrl = env.MATCH_SCHEDULE_BASE_URL?.trim();
  if (!token && !baseUrl) return false;
  const fortuna = await prisma.organization.findUnique({where: {slug: 'fortuna'}});
  if (!fortuna) return false;
  return runWithOrganization(fortuna.id, async () => {
    if (await getMatchSource()) return false;
    await prisma.matchSource.create({
      data: {
        provider: env.MATCH_SCHEDULE_PROVIDER?.trim().toLowerCase() || 'vrijwilligers',
        baseUrl: baseUrl || DEFAULT_MATCH_SOURCE_BASE_URL,
        apiToken: token || null,
      },
    });
    logger.warn('MATCH_SCHEDULE_* env vars copied into Fortuna\'s match source; remove them from the environment');
    return true;
  });
}
