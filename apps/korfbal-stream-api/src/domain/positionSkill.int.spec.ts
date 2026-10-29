import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../main';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {POSITION_TO_SKILL} from './positionSkill';
import {applyStandardSetToTestOrganization, currentSeasonId, testDb as prisma, testOrganizationId} from '../../test-helpers';
import {findOrCreatePosition} from '../services/positions';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = process.env.REQUIRE_DB === 'true';

async function resetDb() {
  // Children before parents. Sequential instead of $transaction([...]): a `.catch()` turns a Prisma
  // call into a plain Promise, which $transaction rejects.
  await prisma.chapterRoleAssignment.deleteMany({});
  await prisma.callSheetItemPosition.deleteMany({});
  await prisma.callSheetItem.deleteMany({});
  await prisma.callSheet.deleteMany({});
  await prisma.productionChapter.deleteMany({});
  await prisma.matchRoleAssignment.deleteMany({});
  await prisma.personSkill.deleteMany({});
  await prisma.person.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.production.deleteMany({});
  await prisma.matchSchedule.deleteMany({});
}

describe.runIf(runDb)('Position -> Skill mapping (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    await applyStandardSetToTestOrganization();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('all skill codes referenced by POSITION_TO_SKILL exist in DB', async () => {
    const codes = Array.from(new Set(Object.values(POSITION_TO_SKILL)));
    for (const code of codes) {
      const skill = await prisma.skill.findFirst({ where: { code } });
      expect(skill, `Skill code missing: ${code}`).toBeTruthy();
    }
  });

  it('GET /segments/:id/positions suggests existing positions and never creates any', async () => {
    // Create minimal production + segment
    const match = await prisma.matchSchedule.create({
      data: { seasonId: await currentSeasonId(prisma), externalId: 'm-map', date: new Date(), homeTeamName: 'Home', awayTeamName: 'Away', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });
    const seg = await prisma.productionChapter.create({ data: { productionId: prod.id, name: 'Intro', orderIndex: 1 } });
    // Spelled differently from the standard list, without a skill
    await prisma.position.create({ data: { name: 'scherm regie' } });
    await prisma.position.create({ data: { name: 'Camera Links' } });
    const before = await prisma.position.count();

    const res = await request(app).get(`/api/production/segments/${seg.id}/positions`);
    expect(res.status).toBe(200);
    const items: Array<{ name: string; requiredSkillCode: string | null }> = res.body;
    expect(items.map((i) => i.name)).toEqual(['Camera Links', 'scherm regie']);
    // The skill comes from the central mapping
    expect(items.find((i) => i.name === 'scherm regie')!.requiredSkillCode).toBe('SCHERM_REGISSEUR');
    expect(await prisma.position.count()).toBe(before);
  });

  it('the standard set matches existing positions and skills instead of adding a second one', async () => {
    const skill = await prisma.skill.create({ data: { code: 'SHOW_CALLER', name: 'Show caller', nameMale: 'Show caller', nameFemale: 'Show caller' } });
    await prisma.skill.deleteMany({ where: { code: 'SHOWCALLER' } });
    await prisma.position.create({ data: { name: 'Show caller', skillId: skill.id } });
    await prisma.position.create({ data: { name: 'regie' } });

    await applyStandardSetToTestOrganization();

    const names = (await prisma.position.findMany()).map((p) => p.name);
    expect(names.filter((n) => n.toLowerCase().replace(/\s/g, '') === 'showcaller')).toEqual(['Show caller']);
    expect(names).toContain('regie');
    expect(names).not.toContain('Regie livestream');
    // The old code is renamed, so the position keeps its skill under the code the application uses
    expect((await prisma.skill.findMany({ where: { code: { in: ['SHOWCALLER', 'SHOW_CALLER'] } } })).map((s) => [s.id, s.code])).toEqual([[skill.id, 'SHOWCALLER']]);
    // The existing position got the missing skill
    const regie = await prisma.position.findFirst({ where: { name: 'regie' }, include: { skill: true } });
    expect(regie?.skill?.code).toBe('REGISSEUR');
  });

  it('POST /positions refuses a name that already exists in another spelling', async () => {
    await prisma.position.create({ data: { name: 'Camera links' } });
    const res = await request(app).post('/api/production/positions').send({ name: 'camera  Links' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Position already exists: Camera links');
  });

  it('imports reuse an existing position under another spelling', async () => {
    const regie = await prisma.position.create({ data: { name: 'Regie livestream' } });
    expect((await findOrCreatePosition(prisma, 'regie')).id).toBe(regie.id);
    expect((await findOrCreatePosition(prisma, 'REGIE LIVESTREAM')).id).toBe(regie.id);
    const created = await findOrCreatePosition(prisma, 'Camera studio', { isStudio: true });
    expect(created).toMatchObject({ name: 'Camera studio', isStudio: true });
    expect(await prisma.position.count()).toBe(2);
  });

  it('POST /segments/:id/assignments enforces required skill from centralized mapping', async () => {
    // Setup production + segment
    const match = await prisma.matchSchedule.create({
      data: { seasonId: await currentSeasonId(prisma), externalId: 'm-enforce', date: new Date(), homeTeamName: 'Home', awayTeamName: 'Away', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });
    const seg = await prisma.productionChapter.create({ data: { productionId: prod.id, name: 'Main', orderIndex: 1 } });

    // Ensure positions exist
    const posLed = await prisma.position.upsert({ where: { organizationId_name: { organizationId: await testOrganizationId(), name: 'ledscherm regie' } }, update: {}, create: { name: 'ledscherm regie' } });

    // Create a person without SCHERM_REGISSEUR skill
    const p = await prisma.person.create({ data: { name: 'Alice', gender: 'female' } });

    // Assign crew at production level with some other skill so they are considered crew
    const someSkill = await prisma.skill.findFirst({ where: { code: 'REGISSEUR' } });
    const ledSkill = await prisma.skill.findFirst({ where: { code: 'SCHERM_REGISSEUR' } });
    expect(someSkill && ledSkill).toBeTruthy();
    await prisma.personSkill.create({ data: { personId: p.id, skillId: someSkill!.id } });
    await prisma.matchRoleAssignment.create({ data: { matchScheduleId: match.id, personId: p.id, skillId: someSkill!.id } });

    // Try to assign to ledscherm regie (should fail - lacks required skill)
    const bad = await request(app).post(`/api/production/segments/${seg.id}/assignments`).send({ personId: p.id, positionId: posLed.id });
    expect(bad.status).toBe(422);

    // Now give the required skill and try again
    await prisma.personSkill.create({ data: { personId: p.id, skillId: ledSkill!.id } });
    const ok = await request(app).post(`/api/production/segments/${seg.id}/assignments`).send({ personId: p.id, positionId: posLed.id });
    expect(ok.status).toBe(201);
  });
});
