import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../../main';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {PrismaClient} from '@prisma/client';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';
const prisma = new PrismaClient();

async function resetDb() {
  await prisma.$transaction([
    prisma.productionEventPosition.deleteMany({}), // Nieuw: ook koppeltabel opschonen
    prisma.productionEvent.deleteMany({}),
    prisma.production.deleteMany({}),
    prisma.matchSchedule.deleteMany({}),
    prisma.position.deleteMany({}), // Nieuw: posities opschonen
  ]);
}

describe('Production Events API (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('creates and lists production events', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-events',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 1',
        awayTeamName: 'Opponent',
        isHomeMatch: true,
      },
    });

    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    const position1 = await prisma.position.create({ data: { name: 'DJ' } });
    const position2 = await prisma.position.create({ data: { name: 'Regisseur' } });

    const createRes = await request(app)
      .post(`/api/production/${prod.id}/events`)
      .send({
        title: 'Oploopfilm',
        vMixInputName: 'oploop',
        order: 1,
        triggerSource: 'VMIX',
        note: 'Start de film',
        durationSec: 60,
        positionIds: [position1.id, position2.id] // Koppel posities
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('Oploopfilm');
    expect(createRes.body.vMixInputName).toBe('oploop');
    expect(createRes.body.order).toBe(1);
    expect(createRes.body.triggerSource).toBe('VMIX');
    expect(createRes.body.note).toBe('Start de film');
    expect(createRes.body.durationSec).toBe(60);
    expect(createRes.body.positions).toHaveLength(2);


    const list = await request(app).get(`/api/production/${prod.id}/events`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
    expect(list.body.items[0].title).toBe('Oploopfilm');
    expect(list.body.items[0].positions).toHaveLength(2);
  });

  it('activates an event via vMix trigger', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-trigger',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 1',
        awayTeamName: 'Opponent',
        isHomeMatch: true,
      },
    });

    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    const event = await prisma.productionEvent.create({
      data: {
        productionId: prod.id,
        title: 'Oploopfilm',
        vMixInputName: 'oploop',
        order: 1,
        triggerSource: 'VMIX',
      },
    });

    const activateRes = await request(app).get('/api/vmix/sync/activate-event?inputName=oploop');
    expect(activateRes.status).toBe(200);

    const updatedEvent = await prisma.productionEvent.findUnique({ where: { id: event.id } });
    expect(updatedEvent?.status).toBe('ACTIVE');
    expect(updatedEvent?.actualStartTime).not.toBeNull();
  });

  it('activates an event via manual trigger', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-manual-trigger',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 1',
        awayTeamName: 'Opponent',
        isHomeMatch: true,
      },
    });

    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    const event = await prisma.productionEvent.create({
      data: {
        productionId: prod.id,
        title: 'Voorstellen uitploeg',
        order: 1,
        triggerSource: 'MANUAL',
      },
    });

    const activateRes = await request(app)
      .post('/api/vmix/production/trigger-manual')
      .send({ eventId: event.id });
    expect(activateRes.status).toBe(200);

    const updatedEvent = await prisma.productionEvent.findUnique({ where: { id: event.id } });
    expect(updatedEvent?.status).toBe('ACTIVE');
    expect(updatedEvent?.actualStartTime).not.toBeNull();
  });

  it('should return unique positions for a production', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-positions',
        date: new Date(),
        homeTeamName: 'Home Team',
        awayTeamName: 'Away Team',
        isHomeMatch: true,
      },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    const pos1 = await prisma.position.create({ data: { name: 'DJ' } });
    const pos2 = await prisma.position.create({ data: { name: 'Regisseur' } });
    const pos3 = await prisma.position.create({ data: { name: 'Commentator' } });

    // Event 1: DJ, Regisseur
    await prisma.productionEvent.create({
      data: {
        productionId: prod.id,
        title: 'Event 1',
        order: 10,
        positions: {
          create: [{ positionId: pos1.id }, { positionId: pos2.id }],
        },
      },
    });

    // Event 2: Regisseur, Commentator
    await prisma.productionEvent.create({
      data: {
        productionId: prod.id,
        title: 'Event 2',
        order: 20,
        positions: {
          create: [{ positionId: pos2.id }, { positionId: pos3.id }],
        },
      },
    });

    // Event 3: Alleen DJ
    await prisma.productionEvent.create({
      data: {
        productionId: prod.id,
        title: 'Event 3',
        order: 30,
        positions: {
          create: [{ positionId: pos1.id }],
        },
      },
    });

    const res = await request(app).get(`/api/production/${prod.id}/events/positions`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3); // Verwacht 3 unieke posities
    const positionNames = res.body.map((p: any) => p.name).sort();
    expect(positionNames).toEqual(['Commentator', 'DJ', 'Regisseur']);
  });
});
