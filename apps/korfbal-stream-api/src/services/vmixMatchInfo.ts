import {prisma} from './prisma';
import {findClubByTeamName} from '../utils/clubs';
import {findSponsorByName, sponsorLogoPath} from './reportSponsors';

const TZ = 'Europe/Amsterdam';

/** One flat row for a vMix data source: every field is a string, empty when unknown. */
export type VmixMatchInfo = {
  productionId: string;
  home: string;
  away: string;
  match: string;
  homeShort: string;
  awayShort: string;
  homeLogo: string;
  awayLogo: string;
  date: string;
  dateShort: string;
  kickoff: string;
  attendanceTime: string;
  liveStart: string;
  accommodation: string;
  field: string;
  referee: string;
  reserveReferee: string;
  referees: string;
  description: string;
  season: string;
  homeScore: string;
  awayScore: string;
  score: string;
  matchSponsor: string;
  matchSponsorLogo: string;
  ballSponsor: string;
  ballSponsorLogo: string;
};

const EMPTY: VmixMatchInfo = {
  productionId: '', home: '', away: '', match: '', homeShort: '', awayShort: '', homeLogo: '', awayLogo: '',
  date: '', dateShort: '', kickoff: '', attendanceTime: '', liveStart: '', accommodation: '', field: '',
  referee: '', reserveReferee: '', referees: '', description: '', season: '', homeScore: '', awayScore: '', score: '',
  matchSponsor: '', matchSponsorLogo: '', ballSponsor: '', ballSponsorLogo: '',
};

const time = (d: Date | null | undefined) =>
  d ? d.toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ}) : '';
const longDate = (d: Date) => d.toLocaleDateString('nl-NL', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ});
const shortDate = (d: Date) => d.toLocaleDateString('nl-NL', {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ});

type MatchInput = {
  productionId: number;
  liveTime: Date | null;
  match: {
    date: Date; homeTeamName: string; awayTeamName: string; attendanceTime: Date | null;
    accommodationName: string | null; fieldName: string | null; refereeName: string | null; reserveRefereeName: string | null;
    description: string | null; homeScore: number | null; awayScore: number | null; season?: { name: string } | null;
  };
  homeClub?: { shortName: string; logoUrl: string | null } | null;
  awayClub?: { shortName: string; logoUrl: string | null } | null;
  matchSponsor?: { name: string; logoPath: string | null } | null;
  ballSponsor?: { name: string; logoPath: string | null } | null;
};

/**
 * The match of a production as vMix title fields. Image fields are full URLs below `assetBaseUrl`
 * (e.g. http://10.0.0.5:3333/uploads), so a vMix title can load them directly.
 */
export function buildVmixMatchInfo(input: MatchInput | null, assetBaseUrl: string): VmixMatchInfo {
  if (!input) return {...EMPTY};
  const {match} = input;
  const asset = (p: string | null | undefined) => {
    if (!p) return '';
    // A club logo can still be the remote URL when downloading it failed during the import
    if (/^https?:\/\//i.test(p)) return p;
    return `${assetBaseUrl.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
  };
  const score = (n: number | null) => (n == null ? '' : String(n));
  const referees = [match.refereeName, match.reserveRefereeName].filter(Boolean).join(' & ');

  return {
    productionId: String(input.productionId),
    home: match.homeTeamName,
    away: match.awayTeamName,
    match: `${match.homeTeamName} - ${match.awayTeamName}`,
    homeShort: input.homeClub?.shortName ?? '',
    awayShort: input.awayClub?.shortName ?? '',
    homeLogo: asset(input.homeClub?.logoUrl),
    awayLogo: asset(input.awayClub?.logoUrl),
    date: longDate(match.date),
    dateShort: shortDate(match.date),
    kickoff: time(match.date),
    attendanceTime: time(match.attendanceTime),
    liveStart: time(input.liveTime),
    accommodation: match.accommodationName ?? '',
    field: match.fieldName ?? '',
    referee: match.refereeName ?? '',
    reserveReferee: match.reserveRefereeName ?? '',
    referees,
    description: match.description ?? '',
    season: match.season?.name ?? '',
    homeScore: score(match.homeScore),
    awayScore: score(match.awayScore),
    score: match.homeScore == null || match.awayScore == null ? '' : `${match.homeScore} - ${match.awayScore}`,
    matchSponsor: input.matchSponsor?.name ?? '',
    matchSponsorLogo: asset(input.matchSponsor?.logoPath),
    ballSponsor: input.ballSponsor?.name ?? '',
    ballSponsorLogo: asset(input.ballSponsor?.logoPath),
  };
}

/** Loads the active production's match, its clubs and sponsors. Null without an active production. */
export async function loadActiveMatchInput(): Promise<MatchInput | null> {
  const production = await prisma.production.findFirst({
    where: {isActive: true},
    orderBy: {createdAt: 'desc'},
    include: {matchSchedule: {include: {season: true}}, productionReport: true},
  });
  if (!production) return null;
  const match = production.matchSchedule;
  const report = production.productionReport;

  const [homeClub, awayClub, sponsors] = await Promise.all([
    findClubByTeamName(prisma, match.homeTeamName),
    findClubByTeamName(prisma, match.awayTeamName),
    report?.matchSponsor || report?.ballSponsor ? prisma.sponsor.findMany() : Promise.resolve([]),
  ]);
  const sponsor = (name: string | null | undefined) =>
    name ? {name, logoPath: sponsorLogoPath(findSponsorByName(name, sponsors))} : null;

  return {
    productionId: production.id,
    liveTime: production.liveTime,
    match,
    homeClub,
    awayClub,
    matchSponsor: sponsor(report?.matchSponsor),
    ballSponsor: sponsor(report?.ballSponsor),
  };
}
