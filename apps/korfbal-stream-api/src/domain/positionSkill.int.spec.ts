import request from 'supertest';
import { execSync } from 'node:child_process';
import app from '../main';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POSITION_TO_SKILL } from './positionSkill';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';
const prisma = new PrismaClient();

async function resetDb() {
  await prisma.$transaction([
    prisma.segmentRoleAssignment.deleteMany({}),
    prisma.callSheetItemPosition.deleteMany({}).catch(() => Promise.resolve()),
    prisma.callSheetItem.deleteMany({}).catch(() => Promise.resolve()),
    prisma.callSheet.deleteMany({}).catch(() => Promise.resolve()),
    prisma.productionSegment.deleteMany({}),
    prisma.matchRoleAssignment.deleteMany({}),
    prisma.personSkill.deleteMany({}),
    prisma.person.deleteMany({}),
    prisma.position.deleteMany({}),
    prisma.production.deleteMany({}),
    prisma.matchSchedule.deleteMany({}),
  ] as any);
}

(runDb ? describe : describe.skip)('Position -> Skill mapping (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('all skill codes referenced by POSITION_TO_SKILL exist in DB', async () => {
    const codes = Array.from(new Set(Object.values(POSITION_TO_SKILL)));
    for (const code of codes) {
      const skill = await prisma.skill.findUnique({ where: { code } });
      expect(skill, `Skill code missing: ${code}`).toBeTruthy();
    }
  });

  it('GET /segments/:id/positions uses centralized mapping for requiredSkillCode', async () => {
    // Create minimal production + segment
    const match = await prisma.matchSchedule.create({
      data: { externalId: 'm-map', date: new Date(), homeTeamName: 'Home', awayTeamName: 'Away', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });
    const seg = await prisma.productionSegment.create({ data: { productionId: prod.id, naam: 'Intro', volgorde: 1, duurInMinuten: 5, isTimeAnchor: false } });

    const res = await request(app).get(`/api/production/segments/${seg.id}/positions`);
    expect(res.status).toBe(200);
    const items: Array<{ name: string; requiredSkillCode: string | null }> = res.body;
    // find ledscherm regie -> must be SCHERM_REGISSEUR
    const led = items.find((i) => i.name === 'ledscherm regie');
    expect(led).toBeTruthy();
    expect(led!.requiredSkillCode).toBe('SCHERM_REGISSEUR');
  });

  it('POST /segments/:id/assignments enforces required skill from centralized mapping', async () => {
    // Setup production + segment
    const match = await prisma.matchSchedule.create({
      data: { externalId: 'm-enforce', date: new Date(), homeTeamName: 'Home', awayTeamName: 'Away', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });
    const seg = await prisma.productionSegment.create({ data: { productionId: prod.id, naam: 'Main', volgorde: 1, duurInMinuten: 5, isTimeAnchor: false } });

    // Ensure positions exist
    const posLed = await prisma.position.upsert({ where: { name: 'ledscherm regie' }, update: {}, create: { name: 'ledscherm regie' } });

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
