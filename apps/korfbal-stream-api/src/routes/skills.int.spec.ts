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
});
