import axios from 'axios';
import {logger} from '../../utils/logger';
import {InvalidMatchScheduleResponseError} from './MatchScheduleProvider';
import type {MatchScheduleFetchParams, MatchScheduleProvider, NormalizedMatchItem} from './MatchScheduleProvider';

type Privacy = 'FULL_NAME' | 'FIRST_NAME' | 'LAST_NAME' | 'HIDDEN';

const teamColors: Record<string, string> = {
  J1: 'red',
  J2: 'red',
  J3: 'red',
  J4: 'orange',
  J5: 'red',
  J6: 'yellow',
  J7: 'yellow',
  J8: 'yellow',
  J9: 'yellow',
  J10: 'green',
  J11: 'green',
  J12: 'green',
  J13: 'green',
  J14: 'green',
  J15: 'green',
  J16: 'green',
  J17: 'green',
  J18: 'green',
  J19: 'blue',
  J20: 'blue',
  J21: 'blue',
  J22: 'blue',
  J23: 'blue',
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Colour of an own youth team ("<club> J1" → red). The club names come from the organization (its
 * name and productionTeamNames), so another organization's teams don't get a colour.
 */
export function colorForTeam(name: string | null | undefined, teamPrefixes: string[]): string | undefined {
  if (!name) return undefined;
  for (const prefix of teamPrefixes) {
    if (!prefix.trim()) continue;
    const m = name.match(new RegExp(`^${escapeRegExp(prefix.trim())}\\s+J(\\d+)\\b`, 'i'));
    if (m) return teamColors[`J${m[1]}`.toUpperCase()];
  }
  return undefined;
}

function refereeDisplay(user?: { privacy?: Privacy; fullName?: string } | null): string | undefined {
  if (!user || !user.privacy) return undefined;
  const full = (user.fullName || '').trim();
  if (!full) return undefined;
  const [first, ...rest] = full.split(' ');
  const last = rest.join(' ').trim();
  switch (user.privacy) {
    case 'FULL_NAME':
      return full;
    case 'FIRST_NAME':
      return first || undefined;
    case 'LAST_NAME':
      return last || undefined;
    case 'HIDDEN':
    default:
      return undefined;
  }
}

/**
 * Filtert niet-scheidsrechter officials (zoals Juryvoorzitter, Schotklokbediener, Tijdwaarnemer)
 * uit een string met officials, en behoudt alleen de scheidsrechters.
 * @param officialsString De invoerstring met alle officials.
 * @returns De string die alleen de scheidsrechters bevat.
 */
export function filterOfficials(officialsString?: string): string | null {
  if (!officialsString) return null;
  // Reguliere expressie om de rollen te matchen die je wilt verwijderen.
  // De pattern zoekt naar:
  // 1. Een ampersand (&) met spaties ervoor/erna (scheiding tussen officials)
  // 2. Gevolgd door een naamstructuur (initialen/voornaam tussen haakjes)
  // 3. En dan een van de te filteren rollen tussen haakjes.
  // Dit patroon is ontworpen om de EERSTE match van een niet-scheidsrechter official
  // en ALLES wat daarna komt te vangen.

  // De rollen die je wilt verwijderen:
  const rolesToFilter = [
    'Juryvoorzitter',
    'Schotklokbediener',
    'Tijdwaarnemer'
  ].join('|'); // maakt 'Juryvoorzitter|Schotklokbediener|Tijdwaarnemer'

  // De regex zoekt naar de separator '&' + spaties, gevolgd door een naam en dan de rol tussen haakjes,
  // en matched vervolgens alles wat daarna komt ($). De 's' flag zorgt ervoor dat '.' ook nieuwe regels matcht.
  const regex = new RegExp(`\\s*&\\s*[^&]*\\((${rolesToFilter})\\).*$`, 's');

  // Vervangt het gevonden deel (de eerste niet-scheidsrechter official en alles erna) door een lege string.
  const filteredString = officialsString.replace(regex, '');
  // Extra schoonmaak: trimt eventuele overgebleven spaties of ampersands aan het einde (wat niet zou moeten gebeuren met de huidige regex, maar voor de zekerheid).
  return filteredString.trim().replace(/[\s&]*$/, '');
}

// Derive a single referee name honoring privacy and falling back to provider name
function pickRefereeName(item: any): string | null {
  const user = item?.refereeAssignment?.user;
  const privacy = user?.privacy?.toUpperCase?.();
  // Honor privacy: FULL_NAME -> full, FIRST_NAME -> first, LAST_NAME -> last, HIDDEN -> masked
  if (privacy) {
    if (privacy === 'HIDDEN') return 'Afgeschermd';
    const disp = refereeDisplay(user);
    if (disp) return disp;
  }
  // No explicit privacy provided: use full name if present
  const fromAssignment: string | undefined = user?.fullName;
  if (fromAssignment && fromAssignment.trim()) return fromAssignment.trim();
  // Fallback to provider name if available and not already masked
  const provider: string | undefined | null = filterOfficials(item?.refereeProviderName);
  if (provider?.trim() && provider !== 'Afgeschermd') return provider.trim();

  return null;
}

// Normalize field display: remove everything up to and including the first '-' and trim
function cleanField(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = String(name).trim();
  const parts = trimmed.split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-').trim();
  }
  return trimmed;
}

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// Returns null for items that can't satisfy the NormalizedMatchItem contract, so
// one malformed upstream row is skipped instead of failing the whole import.
function mapItem(item: any, teamPrefixes: string[]): NormalizedMatchItem | null {
  const rawId = item?.id;
  const externalId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : '';
  const date = toDate(item?.date);
  const homeTeamName = nonEmptyString(item?.homeTeamName);
  const awayTeamName = nonEmptyString(item?.awayTeamName);
  if (!externalId || !date || !homeTeamName || !awayTeamName) {
    logger.warn('Program import: skipping item with missing or invalid id/date/team names', {id: rawId} as any);
    return null;
  }

  const color = colorForTeam(item?.homeTeamName, teamPrefixes) || colorForTeam(item?.homeTeam?.name, teamPrefixes) || undefined;
  const referee = pickRefereeName(item);
  const reserveReferee = refereeDisplay(item?.reserveRefereeAssignment?.user);

  return {
    externalId,
    date,
    homeTeamName,
    awayTeamName,
    accommodationName: item.accommodation?.name || null,
    accommodationRoute: item.accommodation?.route || null,
    attendanceTime: toDate(item.attendanceTime),
    isPracticeMatch: !!item.isPracticeMatch,
    isHomeMatch: !!item.isHomeMatch,
    isCompetitiveMatch: !!item.isCompetitiveMatch,
    fieldName: cleanField(item.fieldName) || null,
    refereeName: referee || null,
    reserveRefereeName: reserveReferee || null,
    color: color || null,
  };
}

/** Upstream time limit; a setting object so tests can shorten it. */
export const MATCH_SOURCE_TIMEOUT = {ms: 10_000};

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The `date` param as the programs endpoint accepts it: a single day as DD-MM-YYYY ("from this day
 * through the end of the published programme") or a range like `30-weeks` (from the current week).
 * An ISO day (our internal form) is converted; the source answers ISO with a server error.
 */
export function toUpstreamDate(date: string): string {
  const iso = ISO_DAY.exec(date.trim());
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : date.trim();
}

/**
 * Fetches match schedule data from the vrijwilligers system
 * (api.sportclubvrijwilligersmanagement.nl "programs" endpoint).
 */
export class VrijwilligersMatchScheduleProvider implements MatchScheduleProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiToken?: string,
    /** Club names of the own teams, e.g. "Korfbalclub/Sponsor" (for the youth team colours) */
    private readonly teamPrefixes: string[] = [],
  ) {
  }

  async fetchMatches({date, location}: MatchScheduleFetchParams): Promise<NormalizedMatchItem[]> {
    const {apiToken} = this;

    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/programs`);
    url.searchParams.set('date', toUpstreamDate(date));
    url.searchParams.set('reserves', 'false');
    if (location !== undefined) url.searchParams.set('location', location);
    url.searchParams.set('levelType', 'ALL');
    url.searchParams.set('sortBy', 'time');

    const headers: Record<string, string> = {accept: 'application/json'};
    if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

    // The token only goes in the header, never in the URL, so the URL is safe to log
    logger.info('Match source request', {provider: 'vrijwilligers', url: url.toString()});
    // No redirects: a redirect could lead past the https-only rule to an internal address (a 3xx is an
    // unexpected answer: SOURCE_INVALID_RESPONSE)
    const response = await axios.get(url.toString(), {headers, timeout: MATCH_SOURCE_TIMEOUT.ms, maxRedirects: 0});

    // API can return either an array of items or an object keyed by ISO date with arrays as values.
    // Anything else (empty body, an HTML error page from a proxy, plain text, an object without
    // arrays such as an error object) is not a valid answer.
    const isArray = Array.isArray(response.data);
    const isObject = !!response.data && typeof response.data === 'object' && !isArray;
    const objectValues = isObject ? Object.values(response.data as Record<string, unknown>) : [];
    const isDateKeyedObject = isObject && (objectValues.length === 0 || objectValues.some(Array.isArray));

    if (!isArray && !isDateKeyedObject) {
      throw new InvalidMatchScheduleResponseError(undefined, response.data);
    }

    // Log counts per date based on the raw shape
    try {
      if (isObject) {
        const entries = Object.entries(response.data as Record<string, any>);
        const totals = entries
          .filter(([, v]) => Array.isArray(v))
          .map(([d, arr]) => ({date: d, count: (arr as any[]).length}))
          .sort((a, b) => a.date.localeCompare(b.date));
        logger.info('Program import: received object keyed by date', {
          dateCount: totals.length,
          totalItems: totals.reduce((sum, t) => sum + t.count, 0),
          perDate: totals,
        } as any);
      } else if (isArray) {
        const arr = response.data as any[];
        const byDate: Record<string, number> = {};
        for (const it of arr) {
          const d = (it?.date ? String(it.date) : '').slice(0, 10);
          if (!d) continue;
          byDate[d] = (byDate[d] || 0) + 1;
        }
        const perDate = Object.entries(byDate)
          .map(([d, count]) => ({date: d, count}))
          .sort((a, b) => a.date.localeCompare(b.date));
        logger.info('Program import: received array, grouped by item.date', {
          dateCount: perDate.length,
          totalItems: arr.length,
          perDate,
        } as any);
      }
    } catch (_) {
      // ignore logging failures
    }

    const rawItems: any[] = isArray
      ? (response.data as any[])
      : Object.values(response.data).filter((v: any) => Array.isArray(v)).flat();

    return rawItems.map((item) => mapItem(item, this.teamPrefixes)).filter((item): item is NormalizedMatchItem => item !== null);
  }
}
