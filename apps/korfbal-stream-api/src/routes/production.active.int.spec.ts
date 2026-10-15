import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {getSetting, setSetting} from '../services/appSettings';
import {ACTIVE_SEASON_ID_KEY, ensureSeasonForDate} from '../services/season';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('GET /api/production/active (integration)', () => {
  let previousActiveSeason: unknown = null;
  let previouslyActive: number[] = [];
  let matchId: number;
  let productionId: number;

  beforeAll(async () => {
    previousActiveSeason = await getSetting(ACTIVE_SEASON_ID_KEY);
    previouslyActive = (await prisma.production.findMany({where: {isActive: true}, select: {id: true}})).map((p) => p.id);
    await prisma.production.updateMany({where: {isActive: true}, data: {isActive: false}});

    // Last season's production is still active, while the new season is already the active one
    const lastSeasonDate = new Date('2026-05-16T18:30:00.000Z');
    const lastSeason = await ensureSeasonForDate(lastSeasonDate);
    const newSeason = await ensureSeasonForDate(new Date('2026-10-17T18:00:00.000Z'));
    const match = await prisma.matchSchedule.create({
      data: {seasonId: lastSeason.id, externalId: `active-int-${Date.now()}`, date: lastSeasonDate, homeTeamName: 'Vorig seizoen', awayTeamName: 'Uit', isHomeMatch: true},
    });
    matchId = match.id;
    productionId = (await prisma.production.create({data: {matchScheduleId: match.id, isActive: true}})).id;
    await setSetting(ACTIVE_SEASON_ID_KEY, newSeason.id);
  });

  afterAll(async () => {
    await prisma.production.deleteMany({where: {id: productionId}});
    await prisma.matchSchedule.deleteMany({where: {id: matchId}});
    if (previouslyActive.length) await prisma.production.updateMany({where: {id: {in: previouslyActive}}, data: {isActive: true}});
    await setSetting(ACTIVE_SEASON_ID_KEY, previousActiveSeason as never);
  });

  it('finds the active production outside the active season, which the season list leaves out', async () => {
    const list = await request(app).get('/api/production');
    expect(list.body.items.map((p: { id: number }) => p.id)).not.toContain(productionId);

    const res = await request(app).get('/api/production/active');
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({id: productionId, isActive: true, matchSchedule: {homeTeamName: 'Vorig seizoen'}});
  });

  it('answers null when no production is active', async () => {
    await prisma.production.update({where: {id: productionId}, data: {isActive: false}});
    const res = await request(app).get('/api/production/active');
    expect(res.body).toEqual({item: null});
  });
});
