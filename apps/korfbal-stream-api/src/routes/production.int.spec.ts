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
    prisma.matchRoleAssignment.deleteMany({}),
    prisma.personCapability.deleteMany({}),
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

  it('manages assignments scoped by production', async () => {
    // Setup production
    const match = await prisma.matchSchedule.create({
      data: { externalId: 'm-assign', date: new Date(), homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opp', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    // Person + capabilities
    const person = await prisma.person.create({ data: { name: 'Alice', gender: 'female' } });
    const role1 = await prisma.capability.findFirst({ where: { code: 'COACH' } });
    const role2 = await prisma.capability.findFirst({ where: { code: 'COMMENTATOR' } });
    expect(role1 && role2).toBeTruthy();

    // Add person capabilities
    await prisma.personCapability.create({ data: { personId: person.id, capabilityId: role1!.id } });
    await prisma.personCapability.create({ data: { personId: person.id, capabilityId: role2!.id } });

    // Create two assignments for same person with different roles
    const a1 = await request(app)
      .post(`/api/production/${prod.id}/assignments`)
      .send({ personId: person.id, capabilityId: role1!.id });
    expect(a1.status).toBe(201);

    const a2 = await request(app)
      .post(`/api/production/${prod.id}/assignments`)
      .send({ personId: person.id, capabilityId: role2!.id });
    expect(a2.status).toBe(201);

    // List should show 2
    const list = await request(app).get(`/api/production/${prod.id}/assignments`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);

    // Update assignment 1 to role2 should conflict (unique per capability per match)
    const patch = await request(app)
      .patch(`/api/production/${prod.id}/assignments/${a1.body.id}`)
      .send({ capabilityId: role2!.id });
    expect([409, 422]).toContain(patch.status);

    // Delete first assignment
    const del = await request(app).delete(`/api/production/${prod.id}/assignments/${a1.body.id}`);
    expect(del.status).toBe(204);
  });
});
