import request from 'supertest';
import {execSync} from 'node:child_process';
import app from '../main';
import {beforeAll, describe, expect, it} from 'vitest';

// Integration test against a real Postgres instance.
// Requires DATABASE_URL to point to a running Postgres and that `prisma` CLI is available.
// You can run: npm run db:up && npm run prisma:deploy && npm run prisma:seed
// Then run: npm run api:test:integration

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';

(runDb ? describe : describe.skip)('Sponsors API (integration)', () => {
  beforeAll(() => {
    // Apply migrations and seed to real DB
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  it('creates and lists sponsors with filtering & pagination (real DB)', async () => {
    const payload = { name: 'Omega BV', type: 'brons', websiteUrl: 'https://omega.example' };
    const createRes = await request(app).post('/api/sponsors').send(payload);
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get('/api/sponsors?type=brons&limit=1&page=1');
    expect(listRes.status).toBe(200);
    expect(listRes.body.limit).toBe(1);
    expect(listRes.body.page).toBe(1);
    expect(listRes.body.items[0].type).toBe('brons');
  });
});
