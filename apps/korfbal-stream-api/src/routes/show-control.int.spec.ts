import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {getCurrentState, stopProduction} from '../services/productionState';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma, inTestOrganization} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

/**
 * The Show Caller's buttons. The phone and wide layouts turn the "end/start of show" answers into a
 * message on screen ("Dit is het laatste item."), so those answers are part of the contract.
 */
describe.runIf(runDb)('Show control (integration)', () => {
  let show: ProductionScenario;
  let productionId: number;
  let ids: string[];

  const status = async () => (await prisma.productionEvent.findMany({where: {productionId}, orderBy: {order: 'asc'}})).map((e) => e.status);

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {active: true, items: [{title: 'Opening'}, {title: 'Interview'}, {title: 'Afsluiting'}]});
    ({productionId, eventIds: ids} = show);
  });

  afterAll(async () => {
    await inTestOrganization(() => stopProduction(productionId));
    await show.cleanup();
  });

  it('starts at the first item and goes forward and back', async () => {
    expect((await request(app).post(`/api/show/start/${productionId}`)).status).toBe(200);
    // startProduction is not awaited by the route
    await new Promise((r) => setTimeout(r, 300));
    expect((await inTestOrganization(async () => getCurrentState())).activeEventId).toBe(ids[0]);
    expect((await request(app).post('/api/show/previous')).body).toEqual({error: 'Start of show reached.'});

    expect((await request(app).post('/api/show/next')).status).toBe(200);
    expect(await status()).toEqual(['COMPLETED', 'ACTIVE', 'WAITING']);

    expect((await request(app).post('/api/show/previous')).status).toBe(200);
    expect((await inTestOrganization(async () => getCurrentState())).activeEventId).toBe(ids[0]);
  });

  it('answers at the end of the show', async () => {
    await request(app).post('/api/show/next');
    await request(app).post('/api/show/next');
    const end = await request(app).post('/api/show/next');
    expect(end.status).toBe(404);
    expect(end.body).toEqual({error: 'End of show reached.'});
  });

  it('stops the show for everyone', async () => {
    expect((await request(app).post(`/api/show/stop/${productionId}`)).status).toBe(200);
    expect((await inTestOrganization(async () => getCurrentState()))).toMatchObject({activeEventId: null, isClockRunning: false});
    expect(await status()).not.toContain('ACTIVE');
  });
});
