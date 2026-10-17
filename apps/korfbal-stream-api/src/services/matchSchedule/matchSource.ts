import type {MatchSource} from '@prisma/client';
import {prisma} from '../prisma';
import {requireOrganizationId} from '../organizationContext';
import {getSetting, PRODUCTION_TEAM_NAMES_KEY} from '../appSettings';
import {normalizeTeamNameForClubMatch} from '../../utils/clubs';
import {isAllowedMatchSourceUrl, type MatchSourceInput} from '../../schemas/organization';
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

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Saves the match source; `apiToken` undefined keeps the stored token, null removes it. A stored token
 * only stays with the provider and origin it was entered for: when either changes without a new token
 * in the same request, the token is removed (otherwise anyone could point it at their own server).
 */
export async function saveMatchSource(input: MatchSourceInput): Promise<MatchSource> {
  const existing = await getMatchSource();
  const movesToken = !!existing && (existing.provider !== input.provider || originOf(existing.baseUrl) !== originOf(input.baseUrl));
  const apiToken = input.apiToken !== undefined ? input.apiToken : movesToken ? null : undefined;
  const data = {
    provider: input.provider,
    baseUrl: input.baseUrl,
    ...(input.isEnabled !== undefined ? {isEnabled: input.isEnabled} : {}),
    ...(apiToken !== undefined ? {apiToken} : {}),
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
  // The address is checked on save too; this also covers rows from before that check
  if (!source || !source.isEnabled || !isAllowedMatchSourceUrl(source.baseUrl)) throw new MatchSourceNotConfiguredError();
  return createMatchScheduleProvider({...source, teamPrefixes: await ownTeamPrefixes()});
}
