import request from 'supertest';
import app from '../../main';
import {beforeEach, describe, expect, it} from 'vitest';
import {PrismaClient} from '@prisma/client';

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

(runDb ? describe : describe.skip)('Positions Export/Import API (integration)', () => {
  beforeEach(async () => {
    // Unique data for each run to avoid parallel test issues
    await resetDb();
  });

  it('exports and then imports positions with skill mapping', async () => {
    // 1. Setup: Create a skill and some positions
    const skillCode = `CAM-${Date.now()}`;
    const skill = await prisma.skill.create({
      data: { code: skillCode, name: 'Camera', nameMale: 'Cameraman', nameFemale: 'Cameravrouw' }
    });

    await prisma.position.create({
      data: { name: `Camera 1-${Date.now()}`, category: 'TECHNICAL', sortOrder: 10, skillId: skill.id }
    });
    await prisma.position.create({
      data: { name: `Regie-${Date.now()}`, category: 'GENERAL', sortOrder: 5 }
    });

    // 2. Export
    const exportRes = await request(app)
      .get('/api/production/export/positions')
      .expect(200);

    expect(Array.isArray(exportRes.body)).toBe(true);
    expect(exportRes.body.length).toBe(2);

    const cam1 = exportRes.body.find((p: any) => p.name.startsWith('Camera 1-'));
    expect(cam1.skillCode).toBe(skillCode);
    expect(cam1.category).toBe('TECHNICAL');

    const regie = exportRes.body.find((p: any) => p.name.startsWith('Regie-'));
    expect(regie.skillCode).toBeNull();

    // 3. Reset positions but keep skill
    await prisma.position.deleteMany({});

    // 4. Modify export data for import test
    const importData = exportRes.body.map((p: any) => {
      if (p.name.startsWith('Regie-')) return { ...p, name: 'Hoofd Regie', sortOrder: 1 };
      return p;
    });
    // Add a new one
    importData.push({
      name: 'Commentaar',
      category: 'GENERAL',
      sortOrder: 20,
      isStudio: false,
      skillCode: null
    });

    // 5. Import
    const importRes = await request(app)
      .post('/api/production/import/positions')
      .send(importData)
      .expect(200);

    expect(importRes.body.ok).toBe(true);
    expect(importRes.body.created).toBe(3);

    // 6. Verify database state
    const positions = await prisma.position.findMany({
      include: { skill: true },
      orderBy: { sortOrder: 'asc' }
    });

    expect(positions.length).toBe(3);
    expect(positions[0].name).toBe('Hoofd Regie');
    expect(positions[1].name.startsWith('Camera 1-')).toBe(true);
    expect(positions[1].skill?.code).toBe(skillCode);
    expect(positions[2].name).toBe('Commentaar');
  });

  it('updates existing positions on import', async () => {
    const posName = `Oudenaam-${Date.now()}`;
     await prisma.position.create({
      data: { name: posName, category: 'TECHNICAL', sortOrder: 10 }
    });

    const importData = [
      { name: posName, category: 'GENERAL', sortOrder: 5, isStudio: true, skillCode: null }
    ];

    const importRes = await request(app)
      .post('/api/production/import/positions')
      .send(importData)
      .expect(200);

    expect(importRes.body.updated).toBe(1);
    expect(importRes.body.created).toBe(0);

    const pos = await prisma.position.findFirst({ where: { name: posName } });
    expect(pos?.category).toBe('GENERAL');
    expect(pos?.sortOrder).toBe(5);
    expect(pos?.isStudio).toBe(true);
  });
});
