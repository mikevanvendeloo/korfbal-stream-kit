import {Prisma, PrismaClient, Season} from '@prisma/client';
import {z} from 'zod';
import {prisma} from './prisma';
import {getSetting, setSetting} from './appSettings';

export const SEASON_TIME_ZONE = 'Europe/Amsterdam';
export const ACTIVE_SEASON_ID_KEY = 'activeSeasonId';

export type SeasonDb = Pick<PrismaClient, 'season'> | Pick<Prisma.TransactionClient, 'season'>;
export type SeasonAssetSubdir = 'players' | 'team-responses';

type SeasonLike = Pick<Season, 'startYear'>;

export class SeasonError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const localPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SEASON_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

function localParts(date: Date): LocalDateParts {
  const parts = Object.fromEntries(
    localPartsFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function timeZoneOffsetMs(instant: Date): number {
  const p = localParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function localToUtc(year: number, monthIndex: number, day: number, h: number, m: number, s: number, ms: number): Date {
  const naive = Date.UTC(year, monthIndex, day, h, m, s, ms);
  const firstGuess = naive - timeZoneOffsetMs(new Date(naive));
  return new Date(naive - timeZoneOffsetMs(new Date(firstGuess)));
}

export function seasonStartYearForDate(date: Date): number {
  const {year, month} = localParts(date);
  return month >= 7 ? year : year - 1;
}

export function seasonNameForStartYear(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

export const MIN_SEASON_START_YEAR = 2000;
export const MAX_SEASON_START_YEAR = 2100;

const SEASON_NAME_RE = /^(\d{4})\/(\d{4})$/;

export function parseSeasonName(name: string): number {
  const match = SEASON_NAME_RE.exec(String(name ?? '').trim());
  if (!match) throw new SeasonError('Seizoensnaam moet de vorm JJJJ/JJJJ hebben, bijv. 2026/2027', 400);
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (second !== first + 1) throw new SeasonError('Het tweede jaar moet direct op het eerste jaar volgen', 400);
  assertValidSeasonStartYear(first);
  return first;
}

/** Throws a 400 SeasonError unless `startYear` is an integer within the supported season range. */
export function assertValidSeasonStartYear(startYear: number): void {
  if (!Number.isInteger(startYear) || startYear < MIN_SEASON_START_YEAR || startYear > MAX_SEASON_START_YEAR) {
    throw new SeasonError(`Een seizoen moet tussen ${MIN_SEASON_START_YEAR} en ${MAX_SEASON_START_YEAR} beginnen`, 400);
  }
}

export function seasonDateRange(startYear: number): { startDate: Date; endDate: Date } {
  return {
    startDate: localToUtc(startYear, 6, 1, 0, 0, 0, 0),
    endDate: localToUtc(startYear + 1, 5, 30, 23, 59, 59, 999),
  };
}

export function seasonDirName(season: SeasonLike): string {
  return `${season.startYear}-${season.startYear + 1}`;
}

export type SeasonAssetDir = `seasons/${string}/${SeasonAssetSubdir}`;

export function seasonAssetDir(season: SeasonLike, sub: SeasonAssetSubdir): SeasonAssetDir {
  return `seasons/${seasonDirName(season)}/${sub}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

/** Finds or creates the season starting in `startYear`; a 400 SeasonError outside the supported range. */
export async function ensureSeasonForStartYear(startYear: number, db: SeasonDb = prisma): Promise<Season> {
  assertValidSeasonStartYear(startYear);
  const where = {startYear};
  try {
    return await db.season.upsert({
      where,
      create: {startYear, name: seasonNameForStartYear(startYear)},
      update: {},
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const existing = await db.season.findUnique({where});
    if (!existing) throw err;
    return existing;
  }
}

export async function ensureSeasonForDate(date: Date, db: SeasonDb = prisma): Promise<Season> {
  return ensureSeasonForStartYear(seasonStartYearForDate(date), db);
}

export interface SeasonIdResolver {
  /** Id of the season containing `date` (created when missing). */
  forDate(date: Date): Promise<number>;
  /** Id of the season starting in `startYear` (created when missing). */
  forStartYear(startYear: number): Promise<number>;
  /** Id of the season named "YYYY/YYYY+1" (created when missing), or undefined for an invalid name. */
  forSeasonName(name: unknown): Promise<number | undefined>;
}

/**
 * Memoizes season lookups per start year so bulk imports don't upsert a season for every row.
 */
export function createSeasonIdResolver(db: SeasonDb = prisma): SeasonIdResolver {
  const cache = new Map<number, Promise<number>>();
  const forStartYear = (startYear: number) => {
    let pending = cache.get(startYear);
    if (!pending) {
      pending = ensureSeasonForStartYear(startYear, db).then((s) => s.id);
      pending.catch(() => cache.delete(startYear));
      cache.set(startYear, pending);
    }
    return pending;
  };
  return {
    forStartYear,
    forDate: (date: Date) => forStartYear(seasonStartYearForDate(date)),
    forSeasonName: async (name: unknown) => {
      const startYear = tryParseSeasonName(name);
      return startYear === undefined ? undefined : forStartYear(startYear);
    },
  };
}

// In-process caches so resolving the active season needs no DB write (and usually no read) per request.
// `activeSeasonCache` holds the row for the stored setting id; `fallbackSeasonCache` the "today" season per
// start year for when the setting is unset or dangling.
let activeSeasonCache: Season | null = null;
const fallbackSeasonCache = new Map<number, Season>();

/** Drops the cached seasons; call after activating/deleting a season or wiping the database. */
export function clearSeasonCache(): void {
  activeSeasonCache = null;
  fallbackSeasonCache.clear();
}

async function fallbackSeason(): Promise<Season> {
  const startYear = seasonStartYearForDate(new Date());
  const cached = fallbackSeasonCache.get(startYear);
  if (cached) return cached;
  const season = (await prisma.season.findUnique({where: {startYear}})) ?? (await ensureSeasonForStartYear(startYear));
  fallbackSeasonCache.set(startYear, season);
  return season;
}

export async function getActiveSeason(): Promise<Season> {
  const storedId = await getSetting<number>(ACTIVE_SEASON_ID_KEY);
  if (typeof storedId === 'number') {
    if (activeSeasonCache?.id === storedId) return activeSeasonCache;
    const season = await prisma.season.findUnique({where: {id: storedId}});
    if (season) {
      activeSeasonCache = season;
      return season;
    }
  }
  return fallbackSeason();
}

/** Loads a season by id or throws a 404 SeasonError. */
export async function findSeasonOrThrow(id: number): Promise<Season>;
export async function findSeasonOrThrow<I extends Prisma.SeasonInclude>(
  id: number,
  include: I,
): Promise<Prisma.SeasonGetPayload<{ include: I }>>;
export async function findSeasonOrThrow(id: number, include?: Prisma.SeasonInclude): Promise<Season> {
  const season = await prisma.season.findUnique({where: {id}, include});
  if (!season) throw new SeasonError('Seizoen niet gevonden', 404);
  return season;
}

export async function setActiveSeason(id: number): Promise<Season> {
  const season = await findSeasonOrThrow(id);
  await setSetting(ACTIVE_SEASON_ID_KEY, season.id);
  clearSeasonCache();
  activeSeasonCache = season;
  return season;
}

/** Largest value of a PostgreSQL `integer` column; larger ids would make Prisma throw instead of a 400. */
export const MAX_SEASON_ID = 2147483647;

/** Season id as sent in a JSON body. */
export const SeasonIdSchema = z.number().int().positive().max(MAX_SEASON_ID);
/** Season id from a query string or route param. */
export const SeasonIdParamSchema = z.coerce.number().int().positive().max(MAX_SEASON_ID);

export function parseOptionalSeasonId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new SeasonError('Invalid seasonId', 400);
  const parsed = SeasonIdParamSchema.safeParse(raw);
  if (!parsed.success) throw new SeasonError('Invalid seasonId', 400);
  return parsed.data;
}

/** Explicit `seasonId` (query/body) when given and existing, otherwise the active season. */
export async function resolveSeason(raw: unknown): Promise<Season> {
  const explicitId = parseOptionalSeasonId(raw);
  if (explicitId === undefined) return getActiveSeason();
  return findSeasonOrThrow(explicitId);
}

export async function resolveSeasonId(raw: unknown): Promise<number> {
  return (await resolveSeason(raw)).id;
}

export interface SeasonDto {
  id: number;
  startYear: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  matchCount: number;
  playerCount: number;
  createdAt: string;
}

export type SeasonWithCounts = Season & { _count: { matches: number; players: number } };

export const SEASON_COUNTS_INCLUDE = {_count: {select: {matches: true, players: true}}} as const;

export function toSeasonDto(season: SeasonWithCounts, activeSeasonId: number): SeasonDto {
  const {startDate, endDate} = seasonDateRange(season.startYear);
  return {
    id: season.id,
    startYear: season.startYear,
    name: season.name,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    isActive: season.id === activeSeasonId,
    matchCount: season._count.matches,
    playerCount: season._count.players,
    createdAt: season.createdAt.toISOString(),
  };
}

export function tryParseSeasonName(name: unknown): number | undefined {
  if (typeof name !== 'string') return undefined;
  try {
    return parseSeasonName(name);
  } catch {
    return undefined;
  }
}
