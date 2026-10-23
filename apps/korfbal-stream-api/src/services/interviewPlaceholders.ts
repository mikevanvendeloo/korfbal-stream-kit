import {prisma} from './prisma';
import {getOwnClubId} from './ownClub';
import {findClubByTeamName} from '../utils/clubs';

/**
 * Interview placeholders in callsheet titles and notes, e.g. "Interview {coach-tegenstander:kort}".
 *   role:   speler | coach
 *   side:   thuis | uit | eigen | tegenstander (eigen/tegenstander follow the own club, so one template fits home and away matches)
 *   format: (none) "Jan de Vries" | kort "J. de Vries" | achternaam "de Vries"
 * Without a selection the placeholder becomes a short label like "coach uit".
 * Keep in sync with apps/korfbal-stream-kit/src/lib/interviewPlaceholders.ts.
 */
export const INTERVIEW_PLACEHOLDER = /\{(speler|coach)-(thuis|uit|eigen|tegenstander)(?::(kort|achternaam))?\}/gi;

export type Side = 'HOME' | 'AWAY';
export type Role = 'PLAYER' | 'COACH';
/** The chosen person behind a placeholder, for the small photo next to the name. */
export type InterviewPerson = { name: string; shirtNo: number | null; photoUrl: string | null };
export type InterviewNames = {
  ownSide: Side;
  names: Record<Side, Record<Role, string | null>>;
  /** The same choice as `names`, with shirt number and photo */
  people: Record<Side, Record<Role, InterviewPerson | null>>;
};

export function shortName(name: string, format?: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || !format) return name.trim();
  const rest = parts.slice(1).join(' ');
  return format.toLowerCase() === 'kort' ? `${parts[0][0]}. ${rest}` : rest;
}

/** Plain text has resolved: null; a placeholder has resolved true (a name) or false (a fallback label), plus whom it names. */
export type PlaceholderSegment = { text: string; resolved: boolean | null; side?: Side; role?: Role };

/** Splits text into plain parts (resolved: null), names (true) and fallback labels (false). */
export function splitInterviewPlaceholders(text: string, names: InterviewNames | null): PlaceholderSegment[] {
  const segments: PlaceholderSegment[] = [];
  let last = 0;
  // A fresh regex: a global one keeps lastIndex between calls
  for (const match of text.matchAll(new RegExp(INTERVIEW_PLACEHOLDER.source, 'gi'))) {
    const [raw, roleWord, sideWord, format] = match;
    const index = match.index ?? 0;
    if (index > last) segments.push({text: text.slice(last, index), resolved: null});
    const role: Role = roleWord.toLowerCase() === 'coach' ? 'COACH' : 'PLAYER';
    const sideKey = sideWord.toLowerCase();
    const ownSide = names?.ownSide ?? 'HOME';
    const side: Side = sideKey === 'thuis' ? 'HOME' : sideKey === 'uit' ? 'AWAY'
      : sideKey === 'eigen' ? ownSide : ownSide === 'HOME' ? 'AWAY' : 'HOME';
    const name = names?.names[side][role];
    segments.push(name
      ? {text: shortName(name, format), resolved: true, side, role}
      : {text: `${roleWord.toLowerCase()} ${sideKey}`, resolved: false, side, role});
    last = index + raw.length;
  }
  if (last < text.length) segments.push({text: text.slice(last), resolved: null});
  return segments;
}

export function resolveInterviewPlaceholders(text: string, names: InterviewNames | null): string {
  if (!text) return text;
  return splitInterviewPlaceholders(text, names).map((s) => s.text).join('');
}

// The match of a production doesn't change during a show; avoids club lookups on every push tick
const ownSideCache = new Map<number, Side>();

async function ownSideFor(productionId: number, match: { homeTeamName: string; awayTeamName: string; isHomeMatch: boolean }): Promise<Side> {
  const cached = ownSideCache.get(productionId);
  if (cached) return cached;
  let side: Side = match.isHomeMatch ? 'HOME' : 'AWAY';
  const ownClubId = await getOwnClubId();
  if (ownClubId) {
    const [home, away] = await Promise.all([
      findClubByTeamName(prisma, match.homeTeamName),
      findClubByTeamName(prisma, match.awayTeamName),
    ]);
    if (home?.id === ownClubId) side = 'HOME';
    else if (away?.id === ownClubId) side = 'AWAY';
  }
  ownSideCache.set(productionId, side);
  return side;
}

/** The selected interview names of a production; like the interview selection, the title-agnostic choice wins. */
export async function loadInterviewNames(productionId: number): Promise<InterviewNames | null> {
  const production = await prisma.production.findUnique({
    where: {id: productionId},
    select: {
      matchSchedule: {select: {homeTeamName: true, awayTeamName: true, isHomeMatch: true}},
      interviewSubjects: {
        select: {side: true, role: true, titleDefinitionId: true, player: {select: {name: true, shirtNo: true, photoUrl: true}}},
        orderBy: {id: 'asc'},
      },
    },
  });
  if (!production) return null;

  const names: InterviewNames['names'] = {HOME: {PLAYER: null, COACH: null}, AWAY: {PLAYER: null, COACH: null}};
  const people: InterviewNames['people'] = {HOME: {PLAYER: null, COACH: null}, AWAY: {PLAYER: null, COACH: null}};
  for (const subject of production.interviewSubjects) {
    if (subject.side === 'NONE') continue;
    const side = subject.side as Side;
    const role = subject.role as Role;
    if (!names[side][role] || subject.titleDefinitionId == null) {
      const {name, shirtNo, photoUrl} = subject.player;
      names[side][role] = name;
      people[side][role] = {name, shirtNo: shirtNo ?? null, photoUrl: photoUrl ?? null};
    }
  }
  return {ownSide: await ownSideFor(productionId, production.matchSchedule), names, people};
}
