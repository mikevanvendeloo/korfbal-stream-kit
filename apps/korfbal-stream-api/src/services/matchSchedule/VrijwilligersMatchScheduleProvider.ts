import axios from 'axios';
import {logger} from '../../utils/logger';
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

function colorForTeam(name?: string | null): string | undefined {
  if (!name) return undefined;
  // Expect names like "Fortuna/Ruitenheer J1" etc
  const m = name.match(/Fortuna\/Ruitenheer\s+J(\d+)/i);
  if (!m) return undefined;
  const key = `J${m[1]}`.toUpperCase();
  return teamColors[key];
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
  logger.info("Filtering officials from string: " + officialsString);
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
  logger.info("Filtered officials string: " + filteredString);
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

function mapItem(item: any): NormalizedMatchItem | null {
  const externalId: string = item?.id;
  if (!externalId) return null;

  const color = colorForTeam(item?.homeTeamName) || colorForTeam(item?.homeTeam?.name) || undefined;
  const referee = pickRefereeName(item);
  const reserveReferee = refereeDisplay(item?.reserveRefereeAssignment?.user);

  return {
    externalId,
    date: new Date(item.date),
    homeTeamName: item.homeTeamName,
    awayTeamName: item.awayTeamName,
    accommodationName: item.accommodation?.name || null,
    accommodationRoute: item.accommodation?.route || null,
    attendanceTime: item.attendanceTime ? new Date(item.attendanceTime) : null,
    isPracticeMatch: !!item.isPracticeMatch,
    isHomeMatch: !!item.isHomeMatch,
    isCompetitiveMatch: !!item.isCompetitiveMatch,
    fieldName: cleanField(item.fieldName) || null,
    refereeName: referee || null,
    reserveRefereeName: reserveReferee || null,
    color: color || null,
  };
}

/**
 * Fetches match schedule data from the vrijwilligers system
 * (api.sportclubvrijwilligersmanagement.nl "programs" endpoint).
 */
export class VrijwilligersMatchScheduleProvider implements MatchScheduleProvider {
  // Read as functions (not plain values) so config changes made after
  // construction (e.g. a token set at runtime) are honored on every call.
  constructor(private readonly getBaseUrl: () => string, private readonly getApiToken: () => string | undefined) {
  }

  async fetchMatches({date, location}: MatchScheduleFetchParams): Promise<NormalizedMatchItem[]> {
    const baseUrl = this.getBaseUrl();
    const apiToken = this.getApiToken();

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/programs`);
    url.searchParams.set('date', date);
    url.searchParams.set('reserves', 'false');
    if (location !== undefined) url.searchParams.set('location', location);
    url.searchParams.set('levelType', 'ALL');
    url.searchParams.set('sortBy', 'time');

    const headers: Record<string, string> = {accept: 'application/json'};
    if (apiToken) headers['Authorization'] = `Bearer ${apiToken}`;

    logger.info('Requesting match schedule using URL ' + url.toString());
    const response = await axios.get(url.toString(), {headers, timeout: 10000});

    if (!response.data) {
      logger.error('Invalid response format from program API', {
        status: response?.status,
        url: url.toString(),
        contentType: response?.headers?.['content-type'],
      } as any);
      throw new Error('Invalid response format from program API');
    }

    // API can return either an array of items or an object keyed by ISO date with arrays as values
    const isArray = Array.isArray(response.data);
    const isObject = !!response.data && typeof response.data === 'object' && !isArray;

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
      : isObject
        ? Object.values(response.data).filter((v: any) => Array.isArray(v)).flat()
        : [];

    return rawItems.map(mapItem).filter((item): item is NormalizedMatchItem => item !== null);
  }
}
