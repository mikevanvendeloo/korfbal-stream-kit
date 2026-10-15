import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {getSetting, setSetting} from '../services/appSettings';
import {ACTIVE_SEASON_ID_KEY, ensureSeasonForDate} from '../services/season';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('GET /api/production/active (integration)', () => {
  let previousActiveSeason: unknown = null;
  let show: ProductionScenario;
  let productionId: number;

  beforeAll(async () => {
    previousActiveSeason = await getSetting(ACTIVE_SEASON_ID_KEY);
    // Last season's production is still active, while the new season is already the active one
    show = await createProductionScenario(prisma, {active: true, items: [], match: {date: new Date('2026-05-16T18:30:00.000Z'), homeTeamName: 'Vorig seizoen'}});
    productionId = show.productionId;
    const newSeason = await ensureSeasonForDate(new Date('2026-10-17T18:00:00.000Z'));
    await setSetting(ACTIVE_SEASON_ID_KEY, newSeason.id);
  });

  afterAll(async () => {
    await show.cleanup();
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
