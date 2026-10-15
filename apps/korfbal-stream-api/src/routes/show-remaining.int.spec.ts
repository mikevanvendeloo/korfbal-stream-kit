import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {setActiveEvent, stopProduction} from '../services/productionState';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';

const runDb = process.env.REQUIRE_DB === 'true';
const ms = (d: Date | null) => d?.getTime() ?? NaN;

describe.runIf(runDb)('POST /api/show/remaining (integration)', () => {
  let show: ProductionScenario;
  let productionId: number;
  const ids = {opening: '', interview: '', promo: ''};

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      active: true,
      items: [{title: 'Opening', durationSec: 300}, {title: 'Interview', durationSec: 120}, {title: 'Promo', durationSec: 60}],
    });
    productionId = show.productionId;
    [ids.opening, ids.interview, ids.promo] = show.eventIds;
  });

  afterAll(async () => {
    await stopProduction(productionId);
    await show.cleanup();
  });

  it('refuses without an active item, and refuses odd values', async () => {
    await stopProduction(productionId);
    expect((await request(app).post('/api/show/remaining').send({seconds: 30})).status).toBe(409);
    expect((await request(app).post('/api/show/remaining').send({seconds: 0})).status).toBe(400);
    expect((await request(app).post('/api/show/remaining').send({seconds: '30'})).status).toBe(400);
  });

  it('sets the remaining time of the active item and moves the following items along', async () => {
    await setActiveEvent(ids.opening, productionId);
    // The opening has run for 40 seconds
    const startedAt = new Date(Date.now() - 40_000);
    await prisma.productionEvent.update({where: {id: ids.opening}, data: {actualStartTime: startedAt}});

    const res = await request(app).post('/api/show/remaining').send({seconds: 30});
    expect(res.status).toBe(200);

    const opening = await prisma.productionEvent.findUniqueOrThrow({where: {id: ids.opening}});
    expect(opening.durationSec).toBeGreaterThanOrEqual(70);
    expect(opening.durationSec).toBeLessThanOrEqual(71);
    expect(opening.actualStartTime?.getTime()).toBe(startedAt.getTime());

    // The interview now starts when the opening ends, about 30 s from now
    const interview = await prisma.productionEvent.findUniqueOrThrow({where: {id: ids.interview}});
    const startsIn = (ms(interview.plannedStartTime) - Date.now()) / 1000;
    expect(startsIn).toBeGreaterThan(25);
    expect(startsIn).toBeLessThan(32);
    const promo = await prisma.productionEvent.findUniqueOrThrow({where: {id: ids.promo}});
    expect(ms(promo.plannedStartTime) - ms(interview.plannedStartTime)).toBe(120_000);
  });
});
