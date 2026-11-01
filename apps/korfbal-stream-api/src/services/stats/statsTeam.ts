import {prisma} from '../prisma';
import {getSetting, PRODUCTION_TEAM_NAMES_KEY} from '../appSettings';
import {getOwnClubId} from '../ownClub';
import {requireOrganizationId} from '../organizationContext';

export type StatsTeam = {value: string; from: 'production' | 'default'};
const DEFAULT_TEAM: StatsTeam = {value: '1', from: 'default'};
const CACHE_MS = 3000;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
/** Only a trailing " <digits>" counts: `Fortuna/Ruitenheer 2` is team 2, `U17-2` is not a team number. */
const trailingNumber = (name: string) => name.match(/\s(\d{1,2})\s*$/)?.[1] ?? null;

/** Which of the two team names is the own team: one of the production team names, else the one starting with the club's name. */
export function ownTeamName(home: string, away: string, productionTeamNames: string[], clubNames: string[]): string | null {
  const names = productionTeamNames.map(norm);
  for (const team of [home, away]) if (names.includes(norm(team))) return team;
  const clubs = clubNames.filter(Boolean).map(norm);
  for (const team of [home, away]) if (clubs.some((c) => norm(team).startsWith(c))) return team;
  return null;
}

async function resolve(): Promise<StatsTeam> {
  const production = await prisma.production.findFirst({where: {isActive: true}, include: {matchSchedule: true}});
  const match = production?.matchSchedule;
  if (!match) return DEFAULT_TEAM;
  const [productionTeamNames, clubId, organization] = await Promise.all([
    getSetting<string[]>(PRODUCTION_TEAM_NAMES_KEY),
    getOwnClubId(),
    prisma.organization.findUnique({where: {id: requireOrganizationId('statistics team')}, select: {name: true}}),
  ]);
  const club = clubId ? await prisma.club.findUnique({where: {id: clubId}, select: {name: true, shortName: true}}) : null;
  const own = ownTeamName(match.homeTeamName, match.awayTeamName, productionTeamNames || [], [club?.name ?? '', club?.shortName ?? '', organization?.name ?? '']);
  const number = own ? trailingNumber(own) : null;
  return number ? {value: String(Number(number)), from: 'production'} : DEFAULT_TEAM;
}

const cache = new Map<number, {at: number; value?: StatsTeam; pending?: Promise<StatsTeam>}>();
export function clearStatsTeamCache(): void {
  cache.clear();
}

/** The team number of the active production, for `{team}` in the database path; 1 by default. Cached 3 s. */
export async function resolveStatsTeam(): Promise<StatsTeam> {
  const orgId = requireOrganizationId('statistics team');
  const hit = cache.get(orgId);
  if (hit?.pending) return hit.pending;
  if (hit?.value && Date.now() - hit.at < CACHE_MS) return hit.value;
  const entry: {at: number; value?: StatsTeam; pending?: Promise<StatsTeam>} = {at: 0};
  entry.pending = resolve().then(
    (value) => {
      entry.value = value;
      entry.at = Date.now();
      entry.pending = undefined;
      return value;
    },
    (err) => {
      cache.delete(orgId);
      throw err;
    },
  );
  cache.set(orgId, entry);
  return entry.pending;
}

export const TEAM_PLACEHOLDER = '{team}';
export const usesTeam = (path: string) => path.includes(TEAM_PLACEHOLDER);
/** Only digits replace the placeholder, so the result still passes the safe path checks. */
export const withTeam = (path: string, team: StatsTeam) => path.split(TEAM_PLACEHOLDER).join(team.value);
