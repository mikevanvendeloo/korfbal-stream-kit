import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../main';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {applyStandardSetToTestOrganization, currentSeasonId, testDb as prisma} from '../../test-helpers';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = process.env.REQUIRE_DB === 'true';

async function resetDb() {
  await prisma.$transaction([
    prisma.chapterRoleAssignment.deleteMany({}),
    prisma.callSheetItemPosition.deleteMany({}),
    prisma.callSheetItem.deleteMany({}),
    prisma.position.deleteMany({}),
  ]);
}

describe.runIf(runDb)('Positions & hoofdstuk standard positions API (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    await applyStandardSetToTestOrganization();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('creates, lists, updates and deletes a position with skill', async () => {
    const cap = await prisma.skill.findFirst();
    expect(cap).toBeTruthy();

    const create = await request(app)
      .post('/api/production/positions')
      .send({ name: 'Interview coordinator', skillId: cap!.id });
    expect(create.status).toBe(201);
    expect(create.body.name).toBe('Interview coordinator');
    expect(create.body.skill?.id).toBe(cap!.id);

    const list = await request(app).get('/api/production/positions');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.find((p: any) => p.name === 'Interview coordinator')).toBeTruthy();

    const upd = await request(app)
      .put(`/api/production/positions/${create.body.id}`)
      .send({ name: 'Interview coördinator', skillId: null });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe('Interview coördinator');
    expect(upd.body.skill).toBeNull();

    const del = await request(app).delete(`/api/production/positions/${create.body.id}`);
    expect(del.status).toBe(204);
  });

  it('creates a position with category and sort order and respects sort order', async () => {
    const create1 = await request(app)
      .post('/api/production/positions')
      .send({ name: 'Camera', category: 'TECHNICAL', sortOrder: 20 });
    expect(create1.status).toBe(201);
    expect(create1.body.name).toBe('Camera');
    expect(create1.body.category).toBe('TECHNICAL');
    expect(create1.body.sortOrder).toBe(20);

    const create2 = await request(app)
      .post('/api/production/positions')
      .send({ name: 'Regie', category: 'GENERAL', sortOrder: 10 });
    expect(create2.status).toBe(201);

    const list = await request(app).get('/api/production/positions');
    expect(list.status).toBe(200);
    expect(list.body.map((p: any) => p.name)).toEqual(['Regie', 'Camera']);
  });

  it('suggests the standard positions of the draaiboek template hoofdstuk with the same name, else the standard list', async () => {
    const posA = await prisma.position.create({ data: { name: 'Camera links' } });
    const posB = await prisma.position.create({ data: { name: 'Commentaar' } });
    const template = await prisma.callSheetTemplate.create({ data: { name: `Posities sjabloon ${Date.now()}` } });
    await prisma.callSheetTemplateChapter.create({
      data: { templateId: template.id, name: 'Voorbeschouwing', orderIndex: 0, positions: { create: [{ positionId: posB.id, orderIndex: 0 }, { positionId: posA.id, orderIndex: 1 }] } },
    });
    const match = await prisma.matchSchedule.create({ data: { seasonId: await currentSeasonId(prisma), externalId: `m-sd-${Date.now()}`, date: new Date(), homeTeamName: 'Fortuna', awayTeamName: 'Opp', isHomeMatch: true } });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id, callSheetTemplateId: template.id } });
    try {
      const voorbeschouwing = await prisma.productionChapter.create({ data: { productionId: prod.id, name: 'Voorbeschouwing', orderIndex: 1 } });
      const rust = await prisma.productionChapter.create({ data: { productionId: prod.id, name: 'Rust', orderIndex: 2 } });

      const fromTemplate = await request(app).get(`/api/production/segments/${voorbeschouwing.id}/positions`);
      expect(fromTemplate.status).toBe(200);
      expect(fromTemplate.body.map((p: any) => p.name)).toEqual(['Commentaar', 'Camera links']);

      const standard = await request(app).get(`/api/production/segments/${rust.id}/positions`);
      expect(standard.status).toBe(200);
      expect(standard.body.map((p: any) => p.name)).toEqual(expect.arrayContaining(['Camera links', 'Commentaar']));
    } finally {
      await prisma.production.delete({ where: { id: prod.id } });
      await prisma.matchSchedule.delete({ where: { id: match.id } });
      await prisma.callSheetTemplate.delete({ where: { id: template.id } });
    }
  });
});
