import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {seasonForDate} from '../../test-scenarios';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

/** Sat 15 February 2031 in Amsterdam: a day no other spec uses */
const DAY = '2031-02-15';
const at = (hour: number) => new Date(`${DAY}T${String(hour).padStart(2, '0')}:00:00.000Z`);

describe.runIf(runDb)('GET /api/match/matches/schedule location filter (integration)', () => {
  const ids: Record<'home' | 'away' | 'manual', number> = {home: 0, away: 0, manual: 0};

  beforeAll(async () => {
    const seasonId = (await seasonForDate(prisma, at(10))).id;
    const create = (data: {date: Date; isHomeMatch: boolean; isManual?: boolean; homeTeamName: string}) =>
      prisma.matchSchedule.create({data: {...data, seasonId, awayTeamName: 'Filter Gast'}});
    ids.home = (await create({date: at(9), isHomeMatch: true, homeTeamName: 'Filter Thuis'})).id;
    ids.away = (await create({date: at(11), isHomeMatch: false, homeTeamName: 'Filter Uit'})).id;
    ids.manual = (await create({date: at(13), isHomeMatch: false, isManual: true, homeTeamName: 'Filter Handmatig'})).id;
  });

  afterAll(async () => {
    await prisma.matchSchedule.deleteMany({where: {id: {in: Object.values(ids)}}});
  });

  const listed = async (location?: string) => {
    const res = await request(app).get(`/api/match/matches/schedule?date=${DAY}${location ? `&location=${location}` : ''}`);
    expect(res.status).toBe(200);
    return res.body.items.map((m: {id: number}) => m.id);
  };

  it('HOME (the default) gives the home and the manual matches', async () => {
    expect(await listed()).toEqual([ids.home, ids.manual]);
    expect(await listed('HOME')).toEqual([ids.home, ids.manual]);
  });

  it('AWAY gives the away and the manual matches', async () => {
    expect(await listed('AWAY')).toEqual([ids.away, ids.manual]);
  });

  it('ALL gives home, away and manual matches', async () => {
    expect(await listed('ALL')).toEqual([ids.home, ids.away, ids.manual]);
  });
});
