import {PrismaClient} from '@prisma/client';
import {logger, logger as defaultLogger} from '../utils/logger';

// Normalize a match team label like "Fortuna/Ruitenheer 2" or
// "LDODK/Rinsma Modeplein U19-1" to a base club name for matching.
// Rules:
// - Trim whitespace
// - Remove a trailing squad designator token at the end, e.g.:
//   - plain numbers (" 1", " 2")
//   - a single letter + digits (" A1", " B2")
//   - youth prefixes U/J with digits and optional -digits (" U19-1", " J21")
// - Collapse internal multiple spaces
export function normalizeTeamNameForClubMatch(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input).trim();
  // Collapse internal whitespace to single spaces
  s = s.replace(/\s+/g, ' ');
  // Remove one trailing squad token (keep base club name)
  const suffixRe = /(\s+(?:[A-Z]?\d+|(?:[UJ]\d+(?:-\d+)?)))$/i;
  s = s.replace(suffixRe, '').trim();
  return s;
}

export async function findClubByTeamName(prisma: PrismaClient | any, teamName: string | null | undefined, log: typeof defaultLogger = defaultLogger): Promise<any | null> {
  if (!teamName) return null;
  const raw = String(teamName).trim();
  const normalized = normalizeTeamNameForClubMatch(raw);
  logger.info('club-match: raw', { raw, normalized });
  // Try exact match first (shortName or name), case-insensitive
  let club = await prisma.club.findFirst({
    where: {
      OR: [
        { shortName: { startsWith: normalized, mode: 'insensitive' } as any },
        { name: { startsWith: normalized, mode: 'insensitive' } as any },
      ],
    } as any,
  });
  if (club) {
    logger.info('club-match: found exact match', { raw, normalized, club: { id: club.id, name: club.name, shortName: club.shortName } });
    log?.debug?.('club-match: exact', { raw, normalized, club: { id: club.id, name: club.name, shortName: club.shortName } });
    return club;
  }
  logger.info('club-match: no exact match, searching for contains');
  // Fallback: contains search (ILIKE)
  club = await prisma.club.findFirst({
    where: {
      OR: [
        { shortName: { startsWith: normalized, mode: 'insensitive' } as any },
        { name: { startsWith: normalized, mode: 'insensitive' } as any },
      ],
    } as any,
  });
  if (club) {
    log?.debug?.('club-match: contains', { raw, normalized, club: { id: club.id, name: club.name, shortName: club.shortName } });
  } else {
    log?.info?.('club-match: not found', { raw, normalized });
  }
  return club;
}

export default { normalizeTeamNameForClubMatch, findClubByTeamName };
