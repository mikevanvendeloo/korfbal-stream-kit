import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../main';
import {beforeAll, describe, expect, it} from 'vitest';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';

(runDb ? describe : describe.skip)('Skills API (integration)', () => {
  beforeAll(() => {
    // Apply migrations and seed to real DB
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  it('creates, lists, updates and deletes a skill (real DB)', async () => {
    const payload = { code: 'TEST_ROLE', name: 'Test Function', nameMale: 'Test Male', nameFemale: 'Test Female' };
    const createRes = await request(app).post('/api/skills').send(payload);
    expect(createRes.status).toBe(201);
    expect(createRes.body.code).toBe('TEST_ROLE');
    expect(createRes.body.name).toBe('Test Function');

    const listRes = await request(app).get('/api/skills?limit=10&page=1');
    expect(listRes.status).toBe(200);
    const items = Array.isArray(listRes.body) ? listRes.body : listRes.body.items;
    expect(items.some((c: any) => c.code === 'TEST_ROLE' && c.name === 'Test Function')).toBe(true);

    const updRes = await request(app).put(`/api/skills/${createRes.body.id}`).send({ nameMale: 'Updated Male' });
    expect(updRes.status).toBe(200);
    expect(updRes.body.nameMale).toBe('Updated Male');

    const delRes = await request(app).delete(`/api/skills/${createRes.body.id}`);
    expect(delRes.status).toBe(204);
  });

  it('exports and imports skills via JSON', async () => {
    // Create some test skills
    const skill1 = { code: 'EXPORT1', name: 'Export Test 1', nameMale: 'Male 1', nameFemale: 'Female 1' };
    const skill2 = { code: 'EXPORT2', name: 'Export Test 2', nameMale: 'Male 2', nameFemale: 'Female 2' };
    await request(app).post('/api/skills').send(skill1);
    await request(app).post('/api/skills').send(skill2);

    // Export
    const exportRes = await request(app).get('/api/skills/export-json');
    expect(exportRes.status).toBe(200);
    expect(Array.isArray(exportRes.body)).toBe(true);
    expect(exportRes.body.some((s: any) => s.code === 'EXPORT1')).toBe(true);

    // Modify exported data
    const exportData = exportRes.body.map((s: any) =>
      s.code === 'EXPORT1' ? { ...s, name: 'Modified Export 1' } : s
    );

    // Add a new skill in export
    exportData.push({ code: 'IMPORT_NEW', name: 'New Import', nameMale: 'New Male', nameFemale: 'New Female' });

    // Import
    const importRes = await request(app).post('/api/skills/import-json').send(exportData);
    expect(importRes.status).toBe(200);
    expect(importRes.body.ok).toBe(true);
    expect(importRes.body.created).toBeGreaterThanOrEqual(1); // At least IMPORT_NEW
    expect(importRes.body.updated).toBeGreaterThanOrEqual(1); // At least EXPORT1 was modified

    // Verify updated skill
    const listRes = await request(app).get('/api/skills?q=EXPORT1');
    const items = Array.isArray(listRes.body) ? listRes.body : listRes.body.items;
    const updated = items.find((s: any) => s.code === 'EXPORT1');
    expect(updated.name).toBe('Modified Export 1');

    // Verify new skill
    const listRes2 = await request(app).get('/api/skills?q=IMPORT_NEW');
    const items2 = Array.isArray(listRes2.body) ? listRes2.body : listRes2.body.items;
    expect(items2.some((s: any) => s.code === 'IMPORT_NEW')).toBe(true);
  });
});
