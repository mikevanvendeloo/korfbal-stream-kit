import request from 'supertest';
import {randomUUID} from 'node:crypto';
import app from '../../main';
import {afterEach, describe, expect, it} from 'vitest';
import {testDb as prisma} from '../../../test-helpers';
import {createProductionScenario, ProductionScenario} from '../../../test-scenarios';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('Production Events API (integration)', () => {
  let show: ProductionScenario | undefined;

  afterEach(async () => {
    await show?.cleanup();
    show = undefined;
  });

  it('creates and lists production events', async () => {
    show = await createProductionScenario(prisma, {items: [{title: 'Bestaand', positions: ['Scenario DJ', 'Scenario Regisseur']}]});
    const positionIds = [show.positionIds['Scenario DJ'], show.positionIds['Scenario Regisseur']];

    const createRes = await request(app)
      .post(`/api/production/${show.productionId}/events`)
      .send({title: 'Oploopfilm', vMixInputName: 'oploop', order: 1, triggerSource: 'VMIX', note: 'Start de film', durationSec: 60, positionIds});
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({title: 'Oploopfilm', vMixInputName: 'oploop', order: 1, triggerSource: 'VMIX', note: 'Start de film', durationSec: 60});
    expect(createRes.body.positions).toHaveLength(2);

    const list = await request(app).get(`/api/production/${show.productionId}/events`);
    expect(list.status).toBe(200);
    const created = list.body.items.find((e: {id: string}) => e.id === createRes.body.id);
    expect(created.title).toBe('Oploopfilm');
    expect(created.positions).toHaveLength(2);
  });

  it('activates an event via vMix trigger', async () => {
    show = await createProductionScenario(prisma, {items: [{title: 'Oploopfilm'}]});
    // Unique: the trigger finds the event by its vMix input name
    const inputName = `oploop-${randomUUID()}`;
    const eventId = show.eventIds[0];
    await prisma.productionEvent.update({where: {id: eventId}, data: {vMixInputName: inputName, triggerSource: 'VMIX'}});

    const activateRes = await request(app).get(`/api/vmix/sync/activate-event?inputName=${inputName}`);
    expect(activateRes.status).toBe(200);

    const updatedEvent = await prisma.productionEvent.findUnique({where: {id: eventId}});
    expect(updatedEvent?.status).toBe('ACTIVE');
    expect(updatedEvent?.actualStartTime).not.toBeNull();
  });

  it('activates an event via manual trigger', async () => {
    show = await createProductionScenario(prisma, {items: [{title: 'Voorstellen uitploeg'}]});
    const eventId = show.eventIds[0];

    const activateRes = await request(app).post('/api/vmix/production/trigger-manual').send({eventId});
    expect(activateRes.status).toBe(200);

    const updatedEvent = await prisma.productionEvent.findUnique({where: {id: eventId}});
    expect(updatedEvent?.status).toBe('ACTIVE');
    expect(updatedEvent?.actualStartTime).not.toBeNull();
  });

  it('returns the unique positions of a production', async () => {
    show = await createProductionScenario(prisma, {
      items: [
        {title: 'Event 1', positions: ['Scenario DJ', 'Scenario Regisseur']},
        {title: 'Event 2', positions: ['Scenario Regisseur', 'Scenario Commentator']},
        {title: 'Event 3', positions: ['Scenario DJ']},
      ],
    });

    const res = await request(app).get(`/api/production/${show.productionId}/events/positions`);
    expect(res.status).toBe(200);
    expect(res.body.map((p: {name: string}) => p.name).sort()).toEqual(['Scenario Commentator', 'Scenario DJ', 'Scenario Regisseur']);
  });
});
