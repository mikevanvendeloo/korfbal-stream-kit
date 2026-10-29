import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {inTestOrganization, testDb as prisma} from '../../test-helpers';
import {DEFAULT_DAY_PLANNING, getDayPlanningSettings, setDayPlanningSettings} from '../services/dayPlanning';

const runDb = process.env.REQUIRE_DB === 'true';

// Sat 12 December 2026 (CET = UTC+1): streams live at 15:15 and 19:15 Amsterdam time
const DAY = '2026-12-12';
const AFTERNOON_LIVE = new Date('2026-12-12T14:15:00.000Z');
const EVENING_LIVE = new Date('2026-12-12T18:15:00.000Z');

describe.runIf(runDb)('day planning: opbouw and verzamelen (integration)', () => {
  const shows: ProductionScenario[] = [];
  let afternoon: ProductionScenario;
  let evening: ProductionScenario;
  let settingsBefore = DEFAULT_DAY_PLANNING;

  beforeAll(async () => {
    settingsBefore = await inTestOrganization(() => getDayPlanningSettings());
    await inTestOrganization(() => setDayPlanningSettings(DEFAULT_DAY_PLANNING));
    afternoon = await createProductionScenario(prisma, {
      // The livestream ends with its last item (openspec/changes/chapters D1)
      items: [{title: 'Wedstrijd', durationSec: 100 * 60}], startsAt: AFTERNOON_LIVE, callSheet: true, liveTime: AFTERNOON_LIVE,
      match: {date: new Date('2026-12-12T14:30:00.000Z'), homeTeamName: 'Dagplanning 2'},
    });
    evening = await createProductionScenario(prisma, {
      items: [{title: 'Wedstrijd', durationSec: 110 * 60}], startsAt: EVENING_LIVE, callSheet: true, liveTime: EVENING_LIVE,
      match: {date: new Date('2026-12-12T18:30:00.000Z'), homeTeamName: 'Dagplanning 1'},
    });
    shows.push(afternoon, evening);
  });

  afterAll(async () => {
    for (const show of shows) await show.cleanup();
    await inTestOrganization(() => setDayPlanningSettings(settingsBefore));
  });

  const planningOf = async (show: ProductionScenario) => {
    const res = await request(app).get(`/api/reports/daily-occupancy?date=${DAY}`);
    expect(res.status).toBe(200);
    return res.body.productions.find((p: { id: number }) => p.id === show.productionId).planning;
  };

  it('plans opbouw before the first stream and verzamelen before each, from the defaults', async () => {
    expect(await planningOf(afternoon)).toEqual({
      setupTime: '2026-12-12T11:45:00.000Z', setupIsDefault: true,
      crewCallTime: '2026-12-12T13:45:00.000Z', crewCallIsDefault: true,
      liveStart: AFTERNOON_LIVE.toISOString(), liveEnd: '2026-12-12T15:55:00.000Z',
    });
    expect(await planningOf(evening)).toMatchObject({setupTime: null, crewCallTime: '2026-12-12T17:45:00.000Z', liveEnd: '2026-12-12T20:05:00.000Z'});
  });

  it('stores an own opbouw and verzameltijd (Amsterdam time from the client), and null brings back the default', async () => {
    const put = await request(app).put(`/api/production/${afternoon.productionId}`).send({setupTime: '2026-12-12T12:00', crewCallTime: '2026-12-12T14:30'});
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({setupTime: '2026-12-12T11:00:00.000Z', crewCallTime: '2026-12-12T13:30:00.000Z'});

    const detail = await request(app).get(`/api/production/${afternoon.productionId}`);
    expect(detail.body.planned).toMatchObject({isFirstOfDay: true, setupTime: '2026-12-12T11:00:00.000Z', setupIsDefault: false, crewCallIsDefault: false});
    expect(await planningOf(afternoon)).toMatchObject({setupTime: '2026-12-12T11:00:00.000Z', crewCallTime: '2026-12-12T13:30:00.000Z'});

    await request(app).put(`/api/production/${afternoon.productionId}`).send({setupTime: null, crewCallTime: null}).expect(200);
    expect(await planningOf(afternoon)).toMatchObject({setupTime: '2026-12-12T11:45:00.000Z', setupIsDefault: true, crewCallIsDefault: true});
  });

  it('refuses an invalid time', async () => {
    const res = await request(app).put(`/api/production/${afternoon.productionId}`).send({crewCallTime: 'gisteren'});
    expect(res.status).toBe(400);
  });

  it('follows the organization\'s minutes from the club settings', async () => {
    const config = (await request(app).get('/api/settings/club-config')).body;
    expect(config).toMatchObject({crewCallMinutes: 30, setupMinutes: 150});

    const put = await request(app).put('/api/settings/club-config').send({ownClubId: config.ownClubId, productionTeamNames: config.productionTeamNames, crewCallMinutes: 45, setupMinutes: 180});
    expect(put.status).toBe(200);
    expect(await planningOf(afternoon)).toMatchObject({setupTime: '2026-12-12T11:15:00.000Z', crewCallTime: '2026-12-12T13:30:00.000Z'});

    // Left out, the minutes stay as they are
    await request(app).put('/api/settings/club-config').send({ownClubId: config.ownClubId, productionTeamNames: config.productionTeamNames}).expect(200);
    expect((await request(app).get('/api/settings/club-config')).body).toMatchObject({crewCallMinutes: 45, setupMinutes: 180});

    const invalid = await request(app).put('/api/settings/club-config').send({ownClubId: config.ownClubId, productionTeamNames: [], crewCallMinutes: -5});
    expect(invalid.status).toBe(400);
    await inTestOrganization(() => setDayPlanningSettings(DEFAULT_DAY_PLANNING));
  });

  it('moves an own opbouw and verzameltijd along when the match moves', async () => {
    const show = await createProductionScenario(prisma, {
      items: [], liveTime: new Date('2026-12-19T18:15:00.000Z'),
      match: {date: new Date('2026-12-19T18:30:00.000Z'), isManual: true, externalId: null, homeTeamName: 'Verplaatst', awayTeamName: 'Uit'},
    });
    shows.push(show);
    await request(app).put(`/api/production/${show.productionId}`).send({setupTime: '2026-12-19T16:00:00.000Z', crewCallTime: '2026-12-19T17:30:00.000Z'}).expect(200);

    const moved = await request(app).put(`/api/manual-matches/${show.matchId}`)
      .send({date: '2026-12-20T18:30:00.000Z', homeTeamName: 'Verplaatst', awayTeamName: 'Uit'});
    expect(moved.status).toBe(200);
    const production = (await request(app).get(`/api/production/${show.productionId}`)).body;
    expect(production).toMatchObject({setupTime: '2026-12-20T16:00:00.000Z', crewCallTime: '2026-12-20T17:30:00.000Z'});
  });
});
