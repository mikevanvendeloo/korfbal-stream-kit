import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as prismaSvc from './prisma';
import {installSeasonMocks, SeasonMockState} from '../../test-helpers';
import {
  ACTIVE_SEASON_ID_KEY,
  createSeasonIdResolver,
  clearSeasonCache,
  ensureSeasonForStartYear,
  findSeasonOrThrow,
  getActiveSeason,
  parseOptionalSeasonId,
  parseSeasonName,
  resolveSeasonId,
  seasonAssetDir,
  seasonDateRange,
  seasonDirName,
  seasonNameForStartYear,
  seasonStartYearForDate,
  setActiveSeason,
  toSeasonDto,
  tryParseSeasonName,
} from './season';

const prisma = (prismaSvc as any).prisma as any;

describe('seasonStartYearForDate', () => {
  it.each([
    ['2026-06-30T21:59:59.999Z', 2025, 'last millisecond of 30 June in Amsterdam (CEST)'],
    ['2026-06-30T22:00:00.000Z', 2026, 'midnight 1 July in Amsterdam although still 30 June in UTC'],
    ['2026-06-30T23:30:00.000Z', 2026, '30 June UTC evening is already 1 July locally'],
    ['2026-07-01T00:00:00.000Z', 2026, 'first of July UTC'],
    ['2026-01-15T12:00:00.000Z', 2025, 'winter belongs to the season that started the previous year'],
    ['2025-12-31T23:30:00.000Z', 2025, 'new year locally (1 Jan 00:30 CET) stays in the same season'],
    ['2026-09-27T10:00:00.000Z', 2026, 'autumn'],
  ])('%s -> %i (%s)', (iso, expected) => {
    expect(seasonStartYearForDate(new Date(iso))).toBe(expected);
  });
});

describe('season names', () => {
  it('formats a start year as YYYY/YYYY+1', () => {
    expect(seasonNameForStartYear(2026)).toBe('2026/2027');
  });

  it.each(['2026/2027', ' 2026/2027 '])('parses %j', (name) => {
    expect(parseSeasonName(name)).toBe(2026);
  });

  it.each(['2026/2028', '2026/2025', '2026-2027', '26/27', '2026/2027x', '', 'abcd/efgh'])('rejects %j', (name) => {
    expect(() => parseSeasonName(name)).toThrow();
  });

  it.each(['1999/2000', '2101/2102'])('rejects start years outside 2000-2100 (%j)', (name) => {
    expect(() => parseSeasonName(name)).toThrow(expect.objectContaining({status: 400}));
  });

  it.each(['2000/2001', '2100/2101'])('accepts the boundary %j', (name) => {
    expect(parseSeasonName(name)).toBe(Number(name.slice(0, 4)));
  });

  it('rejects with a 400 status', () => {
    expect(() => parseSeasonName('2026/2028')).toThrow(expect.objectContaining({status: 400}));
  });

  it('tryParseSeasonName returns undefined instead of throwing', () => {
    expect(tryParseSeasonName('2024/2025')).toBe(2024);
    expect(tryParseSeasonName('bogus')).toBeUndefined();
    expect(tryParseSeasonName(undefined)).toBeUndefined();
    expect(tryParseSeasonName(2024)).toBeUndefined();
  });
});

describe('seasonDateRange', () => {
  it('runs from 1 July 00:00 to 30 June 23:59:59.999 Amsterdam time', () => {
    const {startDate, endDate} = seasonDateRange(2026);
    expect(startDate.toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(endDate.toISOString()).toBe('2027-06-30T21:59:59.999Z');
  });

  it('boundaries map back onto the same season', () => {
    const {startDate, endDate} = seasonDateRange(2025);
    expect(seasonStartYearForDate(startDate)).toBe(2025);
    expect(seasonStartYearForDate(endDate)).toBe(2025);
    expect(seasonStartYearForDate(new Date(startDate.getTime() - 1))).toBe(2024);
    expect(seasonStartYearForDate(new Date(endDate.getTime() + 1))).toBe(2026);
  });
});

describe('season asset directories', () => {
  it('builds the directory names used on disk', () => {
    expect(seasonDirName({startYear: 2026})).toBe('2026-2027');
    expect(seasonAssetDir({startYear: 2026}, 'players')).toBe('seasons/2026-2027/players');
    expect(seasonAssetDir({startYear: 2025}, 'team-responses')).toBe('seasons/2025-2026/team-responses');
  });
});

describe('parseOptionalSeasonId', () => {
  it.each([[undefined], [null], ['']])('treats %j as absent', (raw) => {
    expect(parseOptionalSeasonId(raw)).toBeUndefined();
  });

  it.each([['3', 3], [3, 3], [' 12 ', 12]])('parses %j', (raw, expected) => {
    expect(parseOptionalSeasonId(raw)).toBe(expected);
  });

  it.each([['abc'], ['1.5'], [0], [-2], [['1', '2']], ['2147483648'], [99999999999], [{}], [true]])('rejects %j with status 400', (raw) => {
    expect(() => parseOptionalSeasonId(raw)).toThrow(expect.objectContaining({status: 400}));
  });
});

describe('season persistence helpers', () => {
  let state: SeasonMockState;

  beforeEach(() => {
    state = installSeasonMocks(prisma, {startYears: [2024, 2025]});
  });

  it('ensureSeasonForStartYear creates a missing season with its name', async () => {
    const season = await ensureSeasonForStartYear(2030);
    expect(season.name).toBe('2030/2031');
    expect(state.seasons).toHaveLength(3);
  });

  it.each([1999, 2101, 9998, Number.NaN, 2025.5])(
    'ensureSeasonForStartYear rejects start year %s with a 400 without touching the DB',
    async (startYear) => {
      await expect(ensureSeasonForStartYear(startYear)).rejects.toMatchObject({status: 400});
      expect(prisma.season.upsert).not.toHaveBeenCalled();
    },
  );

  it('ensureSeasonForStartYear accepts the range bounds 2000 and 2100', async () => {
    expect((await ensureSeasonForStartYear(2000)).name).toBe('2000/2001');
    expect((await ensureSeasonForStartYear(2100)).name).toBe('2100/2101');
  });

  it('ensureSeasonForStartYear falls back to the existing row on a concurrent insert', async () => {
    prisma.season.upsert = vi.fn(async () => {
      throw Object.assign(new Error('Unique constraint failed'), {code: 'P2002'});
    });
    const season = await ensureSeasonForStartYear(2025);
    expect(season.startYear).toBe(2025);
  });

  it('ensureSeasonForStartYear rethrows other errors', async () => {
    prisma.season.upsert = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(ensureSeasonForStartYear(2025)).rejects.toThrow('boom');
  });

  it('createSeasonIdResolver upserts once per season across dates, start years and names', async () => {
    const seasons = createSeasonIdResolver();
    const ids = await Promise.all([
      seasons.forDate(new Date('2026-09-01T10:00:00Z')),
      seasons.forDate(new Date('2027-03-01T10:00:00Z')),
      seasons.forDate(new Date('2026-05-01T10:00:00Z')),
      seasons.forStartYear(2026),
      seasons.forSeasonName('2026/2027'),
    ]);
    expect(new Set([ids[0], ids[1], ids[3], ids[4]]).size).toBe(1);
    expect(ids[2]).toBe(state.seasons.find((s) => s.startYear === 2025)!.id);
    expect(prisma.season.upsert).toHaveBeenCalledTimes(2);
  });

  it('createSeasonIdResolver.forSeasonName returns undefined for an invalid name without touching the DB', async () => {
    const seasons = createSeasonIdResolver();
    expect(await seasons.forSeasonName('bogus')).toBeUndefined();
    expect(await seasons.forSeasonName(undefined)).toBeUndefined();
    expect(prisma.season.upsert).not.toHaveBeenCalled();
  });

  it('getActiveSeason returns the stored season', async () => {
    state.settings.set(ACTIVE_SEASON_ID_KEY, 1);
    expect((await getActiveSeason()).startYear).toBe(2024);
  });

  it('getActiveSeason falls back to (and creates) the season containing today when unset or dangling', async () => {
    vi.useFakeTimers({now: new Date('2026-09-27T12:00:00Z'), toFake: ['Date']});
    try {
      state.settings.set(ACTIVE_SEASON_ID_KEY, 999);
      const season = await getActiveSeason();
      expect(season.name).toBe('2026/2027');
      expect(state.seasons.some((s) => s.startYear === 2026)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('getActiveSeason fallback reads first and memoizes, so repeated calls do not write', async () => {
    vi.useFakeTimers({now: new Date('2025-09-27T12:00:00Z'), toFake: ['Date']});
    try {
      const first = await getActiveSeason();
      await getActiveSeason();
      await getActiveSeason();
      expect(first.startYear).toBe(2025);
      expect(prisma.season.upsert).not.toHaveBeenCalled();
      expect(prisma.season.findUnique).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('getActiveSeason caches the stored season until the active season changes', async () => {
    state.settings.set(ACTIVE_SEASON_ID_KEY, 1);
    await getActiveSeason();
    await getActiveSeason();
    expect(prisma.season.findUnique).toHaveBeenCalledTimes(1);

    await setActiveSeason(2);
    expect((await getActiveSeason()).id).toBe(2);
    clearSeasonCache();
    expect((await getActiveSeason()).id).toBe(2);
  });

  it('findSeasonOrThrow returns the season (with include) or throws 404', async () => {
    state.counts.set(1, {matches: 3, players: 4});
    const season = await findSeasonOrThrow(1, {_count: {select: {matches: true, players: true}}});
    expect(season._count).toEqual({matches: 3, players: 4});
    await expect(findSeasonOrThrow(999)).rejects.toMatchObject({status: 404});
  });

  it('setActiveSeason stores the id and rejects unknown seasons with 404', async () => {
    await setActiveSeason(2);
    expect(state.settings.get(ACTIVE_SEASON_ID_KEY)).toBe(2);
    expect((await getActiveSeason()).id).toBe(2);
    await expect(setActiveSeason(999)).rejects.toMatchObject({status: 404});
  });

  it('resolveSeasonId returns the explicit season, the active season, or 404', async () => {
    state.settings.set(ACTIVE_SEASON_ID_KEY, 2);
    expect(await resolveSeasonId('1')).toBe(1);
    expect(await resolveSeasonId(undefined)).toBe(2);
    await expect(resolveSeasonId('77')).rejects.toMatchObject({status: 404});
  });
});

describe('toSeasonDto', () => {
  it('maps a season with counts to the REST contract', () => {
    const dto = toSeasonDto(
      {id: 3, startYear: 2026, name: '2026/2027', createdAt: new Date('2026-08-01T00:00:00Z'), _count: {matches: 4, players: 9}},
      3,
    );
    expect(dto).toEqual({
      id: 3,
      startYear: 2026,
      name: '2026/2027',
      startDate: '2026-06-30T22:00:00.000Z',
      endDate: '2027-06-30T21:59:59.999Z',
      isActive: true,
      matchCount: 4,
      playerCount: 9,
      createdAt: '2026-08-01T00:00:00.000Z',
    });
  });
});
