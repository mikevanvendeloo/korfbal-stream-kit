import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../main';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {PrismaClient} from '@prisma/client';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';

const prisma = new PrismaClient();

async function resetDb() {
  // truncate key tables between tests
  await prisma.$transaction([
    prisma.matchRoleAssignment.deleteMany({}),
    prisma.personSkill.deleteMany({}),
    prisma.person.deleteMany({}),
    prisma.matchSchedule.deleteMany({}),
  ]);
}

(runDb ? describe : describe.skip)('Persons API (integration)', () => {
  beforeAll(async () => {
    // Apply migrations and seed to real DB
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('creates, lists, updates and deletes a person', async () => {
    const createRes = await request(app).post('/api/persons').send({ name: 'Alice', gender: 'female' });
    expect(createRes.status).toBe(201);
    const alice = createRes.body;

    const listRes = await request(app).get('/api/persons?page=1&limit=10&q=Ali');
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBe(1);

    const getRes = await request(app).get(`/api/persons/${alice.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('Alice');

    const updRes = await request(app).put(`/api/persons/${alice.id}`).send({ name: 'Alice Doe' });
    expect(updRes.status).toBe(200);
    expect(updRes.body.name).toBe('Alice Doe');

    const delRes = await request(app).delete(`/api/persons/${alice.id}`);
    expect(delRes.status).toBe(204);

    const notFound = await request(app).get(`/api/persons/${alice.id}`);
    expect(notFound.status).toBe(404);
  });

  it('adds and removes capabilities, validates duplicates', async () => {
    // Create a person and use seeded production functions
    const p = await request(app).post('/api/persons').send({ name: 'Bob', gender: 'male' }).then(r => r.body);
    const cap = await prisma.skill.findFirst({ where: { code: 'COACH' } });
    expect(cap).toBeTruthy();

    // Add skill
    const addRes = await request(app).post(`/api/persons/${p.id}/skills`).send({ skillId: cap!.id });
    expect(addRes.status).toBe(201);

    // Idempotent upsert -> 201 first time, conflict on explicit unique
    const again = await request(app).post(`/api/persons/${p.id}/skills`).send({ skillId: cap!.id });
    expect([201, 409]).toContain(again.status);

    // List capabilities
    const listCaps = await request(app).get(`/api/persons/${p.id}/skills`);
    expect(listCaps.status).toBe(200);
    expect(Array.isArray(listCaps.body)).toBe(true);
    expect(listCaps.body.length).toBe(1);

    // Remove skill
    const delCap = await request(app).delete(`/api/persons/${p.id}/skills/${cap!.id}`);
    expect(delCap.status).toBe(204);

    // Removing again -> 404
    const delCap404 = await request(app).delete(`/api/persons/${p.id}/skills/${cap!.id}`);
    expect(delCap404.status).toBe(404);
  });

  it('creates, lists, updates and deletes match role assignments with skill enforcement', async () => {
    // Arrange data
    const person = await request(app).post('/api/persons').send({ name: 'Cara', gender: 'female' }).then(r => r.body);
    const role = await prisma.skill.findFirst({ where: { code: 'COMMENTATOR' } });
    expect(role).toBeTruthy();

    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'test-match-1',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer J1',
        awayTeamName: 'Opponent J1',
      },
    });

    // Cannot assign without skill
    const failAssign = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, skillId: role!.id });
    expect(failAssign.status).toBe(422);

    // Add skill
    await request(app).post(`/api/persons/${person.id}/skills`).send({ skillId: role!.id });

    // Create assignment
    const create = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, skillId: role!.id });
    expect(create.status).toBe(201);

    // Allow multiple persons for the same role: add a second person with same role
    const otherPerson = await request(app).post('/api/persons').send({ name: 'Eve', gender: 'female' }).then(r => r.body);
    await request(app).post(`/api/persons/${otherPerson.id}/skills`).send({ skillId: role!.id });
    const secondAssign = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: otherPerson.id, skillId: role!.id });
    expect(secondAssign.status).toBe(201);

    // Prevent exact duplicate for same person+role
    const duplicateSamePerson = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, skillId: role!.id });
    expect([409]).toContain(duplicateSamePerson.status);

    // List should now have two assignments for the same role
    const list = await request(app).get(`/api/persons/matches/${match.id}/assignments`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);

    // Update: switch to another role after adding skill
    const otherRole = await prisma.skill.findFirst({ where: { code: 'PRESENTATOR' } });
    expect(otherRole).toBeTruthy();
    await request(app).post(`/api/persons/${person.id}/skills`).send({ skillId: otherRole!.id });

    const patch = await request(app)
      .patch(`/api/persons/matches/${match.id}/assignments/${create.body.id}`)
      .send({ skillId: otherRole!.id });
    expect(patch.status).toBe(200);
    expect(patch.body.skillId).toBe(otherRole!.id);

    // Delete
    const del = await request(app).delete(`/api/persons/matches/${match.id}/assignments/${create.body.id}`);
    expect(del.status).toBe(204);
  });

  it('allows same person to have multiple roles in the same match', async () => {
    const person = await request(app).post('/api/persons').send({ name: 'Daan', gender: 'male' }).then(r => r.body);
    const role1 = await prisma.skill.findFirst({ where: { code: 'COACH' } });
    const role2 = await prisma.skill.findFirst({ where: { code: 'COMMENTATOR' } });
    expect(role1 && role2).toBeTruthy();

    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'test-match-multi-1',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer J2',
        awayTeamName: 'Opponent J2',
      },
    });

    // Person must have the capabilities first
    await request(app).post(`/api/persons/${person.id}/skills`).send({ skillId: role1!.id });
    await request(app).post(`/api/persons/${person.id}/skills`).send({ skillId: role2!.id });

    // Assign both roles to the same person for this match
    const a1 = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, skillId: role1!.id });
    expect(a1.status).toBe(201);

    const a2 = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, skillId: role2!.id });
    expect(a2.status).toBe(201);

    // List should contain two assignments
    const list = await request(app).get(`/api/persons/matches/${match.id}/assignments`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);
  });
});
