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
  await prisma.$transaction([
    prisma.segmentDefaultPosition.deleteMany({}),
    prisma.segmentRoleAssignment.deleteMany({}),
    prisma.callSheetItemPosition.deleteMany({}),
    prisma.callSheetItem.deleteMany({}),
    prisma.position.deleteMany({}),
  ]);
}

(runDb ? describe : describe.skip)('Positions & Segment Defaults API (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
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

  it('configures segment default positions and reads them via segment endpoint', async () => {
    // Create positions
    const posA = await prisma.position.create({ data: { name: 'Camera links' } });
    const posB = await prisma.position.create({ data: { name: 'Regie' } });

    const put = await request(app)
      .put('/api/production/segment-default-positions')
      .send({ segmentName: 'Voorbeschouwing', positions: [ { positionId: posA.id, order: 0 }, { positionId: posB.id, order: 1 } ] });
    expect(put.status).toBe(200);
    expect(put.body.length).toBe(2);

    // Create production + segment with that name
    const match = await prisma.matchSchedule.create({ data: { externalId: 'm-sd-1', date: new Date(), homeTeamName: 'Fortuna', awayTeamName: 'Opp', isHomeMatch: true } });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });
    const seg = await prisma.productionSegment.create({ data: { productionId: prod.id, naam: 'Voorbeschouwing', volgorde: 1, duurInMinuten: 10, isTimeAnchor: false } });

    const list = await request(app).get(`/api/production/segments/${seg.id}/positions`);
    expect(list.status).toBe(200);
    expect(list.body.map((p: any) => p.name)).toEqual(['Camera links', 'Regie']);
  });

  it('lists configured segment default names and applies global fallback', async () => {
    // Create positions
    const posA = await prisma.position.create({ data: { name: 'Camera rechts' } });
    const posB = await prisma.position.create({ data: { name: 'Commentaar' } });

    // Create GLOBAL defaults
    await prisma.segmentDefaultPosition.createMany({
      data: [
        { segmentName: '__GLOBAL__', positionId: posA.id, order: 0 },
        { segmentName: '__GLOBAL__', positionId: posB.id, order: 1 },
      ],
      skipDuplicates: true,
    });

    // Names endpoint should include __GLOBAL__
    const names = await request(app).get('/api/production/segment-default-positions/names');
    expect(names.status).toBe(200);
    expect(names.body.items).toContain('__GLOBAL__');

    // Create production + a segment without specific config -> should use GLOBAL
    const match = await prisma.matchSchedule.create({ data: { externalId: 'm-sd-2', date: new Date(), homeTeamName: 'Fortuna', awayTeamName: 'Opp', isHomeMatch: true } });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });
    const segRust = await prisma.productionSegment.create({ data: { productionId: prod.id, naam: 'Rust', volgorde: 2, duurInMinuten: 15, isTimeAnchor: false } });

    const listRust = await request(app).get(`/api/production/segments/${segRust.id}/positions`);
    expect(listRust.status).toBe(200);
    expect(listRust.body.map((p: any) => p.name)).toEqual(['Camera rechts', 'Commentaar']);

    // Now configure specific defaults for "Rust" and ensure it overrides global
    const posC = await prisma.position.create({ data: { name: 'Regie' } });
    await prisma.segmentDefaultPosition.createMany({ data: [ { segmentName: 'Rust', positionId: posC.id, order: 0 } ] });
    const listRust2 = await request(app).get(`/api/production/segments/${segRust.id}/positions`);
    expect(listRust2.status).toBe(200);
    expect(listRust2.body.map((p: any) => p.name)).toEqual(['Regie']);
  });
});
