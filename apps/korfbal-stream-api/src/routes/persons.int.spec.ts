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
  // truncate key tables between tests
  await prisma.$transaction([
    prisma.matchRoleAssignment.deleteMany({}),
    prisma.personCapability.deleteMany({}),
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
    const cap = await prisma.capability.findFirst({ where: { code: 'COACH' } });
    expect(cap).toBeTruthy();

    // Add capability
    const addRes = await request(app).post(`/api/persons/${p.id}/capabilities`).send({ capabilityId: cap!.id });
    expect(addRes.status).toBe(201);

    // Idempotent upsert -> 201 first time, conflict on explicit unique
    const again = await request(app).post(`/api/persons/${p.id}/capabilities`).send({ capabilityId: cap!.id });
    expect([201, 409]).toContain(again.status);

    // List capabilities
    const listCaps = await request(app).get(`/api/persons/${p.id}/capabilities`);
    expect(listCaps.status).toBe(200);
    expect(Array.isArray(listCaps.body)).toBe(true);
    expect(listCaps.body.length).toBe(1);

    // Remove capability
    const delCap = await request(app).delete(`/api/persons/${p.id}/capabilities/${cap!.id}`);
    expect(delCap.status).toBe(204);

    // Removing again -> 404
    const delCap404 = await request(app).delete(`/api/persons/${p.id}/capabilities/${cap!.id}`);
    expect(delCap404.status).toBe(404);
  });

  it('creates, lists, updates and deletes match role assignments with capability enforcement', async () => {
    // Arrange data
    const person = await request(app).post('/api/persons').send({ name: 'Cara', gender: 'female' }).then(r => r.body);
    const role = await prisma.capability.findFirst({ where: { code: 'COMMENTATOR' } });
    expect(role).toBeTruthy();

    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'test-match-1',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer J1',
        awayTeamName: 'Opponent J1',
      },
    });

    // Cannot assign without capability
    const failAssign = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, capabilityId: role!.id });
    expect(failAssign.status).toBe(422);

    // Add capability
    await request(app).post(`/api/persons/${person.id}/capabilities`).send({ capabilityId: role!.id });

    // Create assignment
    const create = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, capabilityId: role!.id });
    expect(create.status).toBe(201);

    // Allow multiple persons for the same role: add a second person with same role
    const otherPerson = await request(app).post('/api/persons').send({ name: 'Eve', gender: 'female' }).then(r => r.body);
    await request(app).post(`/api/persons/${otherPerson.id}/capabilities`).send({ capabilityId: role!.id });
    const secondAssign = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: otherPerson.id, capabilityId: role!.id });
    expect(secondAssign.status).toBe(201);

    // Prevent exact duplicate for same person+role
    const duplicateSamePerson = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, capabilityId: role!.id });
    expect([409]).toContain(duplicateSamePerson.status);

    // List should now have two assignments for the same role
    const list = await request(app).get(`/api/persons/matches/${match.id}/assignments`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);

    // Update: switch to another role after adding capability
    const otherRole = await prisma.capability.findFirst({ where: { code: 'PRESENTATOR' } });
    expect(otherRole).toBeTruthy();
    await request(app).post(`/api/persons/${person.id}/capabilities`).send({ capabilityId: otherRole!.id });

    const patch = await request(app)
      .patch(`/api/persons/matches/${match.id}/assignments/${create.body.id}`)
      .send({ capabilityId: otherRole!.id });
    expect(patch.status).toBe(200);
    expect(patch.body.capabilityId).toBe(otherRole!.id);

    // Delete
    const del = await request(app).delete(`/api/persons/matches/${match.id}/assignments/${create.body.id}`);
    expect(del.status).toBe(204);
  });

  it('allows same person to have multiple roles in the same match', async () => {
    const person = await request(app).post('/api/persons').send({ name: 'Daan', gender: 'male' }).then(r => r.body);
    const role1 = await prisma.capability.findFirst({ where: { code: 'COACH' } });
    const role2 = await prisma.capability.findFirst({ where: { code: 'COMMENTATOR' } });
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
    await request(app).post(`/api/persons/${person.id}/capabilities`).send({ capabilityId: role1!.id });
    await request(app).post(`/api/persons/${person.id}/capabilities`).send({ capabilityId: role2!.id });

    // Assign both roles to the same person for this match
    const a1 = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, capabilityId: role1!.id });
    expect(a1.status).toBe(201);

    const a2 = await request(app)
      .post(`/api/persons/matches/${match.id}/assignments`)
      .send({ personId: person.id, capabilityId: role2!.id });
    expect(a2.status).toBe(201);

    // List should contain two assignments
    const list = await request(app).get(`/api/persons/matches/${match.id}/assignments`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);
  });
});
