import request from 'supertest';
import { execSync } from 'node:child_process';
import app from '../main';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';
const prisma = new PrismaClient();

async function resetDb() {
  await prisma.$transaction([
    prisma.productionPerson.deleteMany({}),
    prisma.matchRoleAssignment.deleteMany({}),
    prisma.personSkill.deleteMany({}),
    prisma.person.deleteMany({}),
    prisma.production.deleteMany({}),
    prisma.matchSchedule.deleteMany({}),
  ]);
}

(runDb ? describe : describe.skip)('Production API (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('creates, lists, updates and deletes a production', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-1',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 1',
        awayTeamName: 'Opponent',
        isHomeMatch: true,
      },
    });

    const createRes = await request(app).post('/api/production').send({ matchScheduleId: match.id });
    expect(createRes.status).toBe(201);

    const list = await request(app).get('/api/production');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);

    // Update to another match
    const match2 = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-2',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 2',
        awayTeamName: 'Opponent 2',
        isHomeMatch: true,
      },
    });

    const upd = await request(app).put(`/api/production/${createRes.body.id}`).send({ matchScheduleId: match2.id });
    expect(upd.status).toBe(200);
    expect(upd.body.matchScheduleId).toBe(match2.id);

    const del = await request(app).delete(`/api/production/${createRes.body.id}`);
    expect(del.status).toBe(204);
  });

  it('manages production persons (attendance tracking)', async () => {
    // Setup production
    const match = await prisma.matchSchedule.create({
      data: { externalId: 'm-persons', date: new Date(), homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opp', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    // Create persons
    const alice = await prisma.person.create({ data: { name: 'Alice', gender: 'female' } });
    const bob = await prisma.person.create({ data: { name: 'Bob', gender: 'male' } });

    // Initially no persons present
    const list1 = await request(app).get(`/api/production/${prod.id}/persons`);
    expect(list1.status).toBe(200);
    expect(list1.body.length).toBe(0);

    // Mark Alice as present
    const add1 = await request(app)
      .post(`/api/production/${prod.id}/persons`)
      .send({ personId: alice.id });
    expect(add1.status).toBe(201);

    // Mark Bob as present
    const add2 = await request(app)
      .post(`/api/production/${prod.id}/persons`)
      .send({ personId: bob.id });
    expect(add2.status).toBe(201);

    // List should show 2
    const list2 = await request(app).get(`/api/production/${prod.id}/persons`);
    expect(list2.status).toBe(200);
    expect(list2.body.length).toBe(2);

    // Adding Alice again should conflict
    const addDupe = await request(app)
      .post(`/api/production/${prod.id}/persons`)
      .send({ personId: alice.id });
    expect(addDupe.status).toBe(409);

    // Remove Alice
    const del = await request(app).delete(`/api/production/${prod.id}/persons/${add1.body.id}`);
    expect(del.status).toBe(204);

    // List should show 1
    const list3 = await request(app).get(`/api/production/${prod.id}/persons`);
    expect(list3.status).toBe(200);
    expect(list3.body.length).toBe(1);
    expect(list3.body[0].person.name).toBe('Bob');
  });
});
