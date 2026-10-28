import http from 'node:http';
import https from 'node:https';
import supertest from 'supertest';
import {afterAll, beforeAll} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {useTestDatabase} from './test-database';
import {TEST_ORGANIZATION_SLUG} from '../test-scenarios';

// supertest listens on a random port on all interfaces ('::') and then connects to 127.0.0.1. When
// another process (e.g. a Docker or kind port) holds that port on 127.0.0.1 only, the bind still
// succeeds and the request reaches that process instead: random 401s, 'Parse Error: Expected HTTP/',
// hangs. Connect over the loopback of the family the test server actually bound to.
const {Test} = supertest as unknown as {Test: {prototype: {serverAddress: (app: any, path: string) => string; _server?: unknown}}};
Test.prototype.serverAddress = function (this: {_server?: unknown}, app: any, path: string) {
  if (!app.address()) this._server = app.listen(0);
  const {port, family} = app.address();
  const protocol = app instanceof https.Server ? 'https' : 'http';
  const host = family === 'IPv6' ? '[::1]' : '127.0.0.1';
  return `${protocol}://${host}:${port}${path}`;
};

// Every API request in the tests runs as the test organization unless the test chooses otherwise:
// `.set('X-Organization', 'other')`, or `withoutOrganization(request(app).get(...))` (test-helpers.ts).
const {Test: OrganizationTest} = supertest as unknown as {Test: {prototype: {end: (...args: unknown[]) => unknown}}};
const originalEnd = OrganizationTest.prototype.end;
OrganizationTest.prototype.end = function (this: {withoutOrganization?: boolean; get: (h: string) => unknown; set: (h: string, v: string) => void}, ...args: unknown[]) {
  if (!this.withoutOrganization && this.get('X-Organization') === undefined) this.set('X-Organization', TEST_ORGANIZATION_SLUG);
  return originalEnd.apply(this, args);
};

// supertest starts (and closes) a new server for every request. Node's default agent keeps connections
// alive, so a pooled socket to a closed test server can be reused for a later request: 'socket hang up'.
http.globalAgent = new http.Agent({keepAlive: false});

// Before any other code connects: always the separate test database, never the dev one from .env
useTestDatabase();

const prisma = new PrismaClient();

// Unit tests (no database): the organization middleware still looks the slug up, so answer it here.
if (process.env.REQUIRE_DB !== 'true') {
  const {prisma: appPrisma} = await import('./services/prisma');
  const testOrganization = {id: 1, slug: TEST_ORGANIZATION_SLUG, name: 'Test', logoUrl: null, clubId: null, isActive: true, createdAt: new Date(0)};
  (appPrisma as any).organization = {
    findUnique: async ({where}: {where: {slug?: string; id?: number}}) =>
      where.slug === TEST_ORGANIZATION_SLUG || where.id === testOrganization.id ? testOrganization : null,
  };
}

beforeAll(async () => {
  // Check if database is required and available
  if (process.env.REQUIRE_DB === 'true') {
    try {
      await prisma.$connect();
      console.log('Database connection verified.');
    } catch (e) {
      console.error('Failed to connect to database but REQUIRE_DB is set to true:', e);
      throw e;
    }
  }

  // Skipping database reset for unit tests if not using a real DB
  // Ensure the test database schema is up-to-date and all data is cleared
  // before starting the test run.
  if (process.env.SKIP_DB_RESET !== 'true') {
    console.log('Resetting test database...');
    try {
      // execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('Test database reset complete.');
    } catch (e) {
      console.error('Failed to reset test database:', e);
      if (process.env.REQUIRE_DB === 'true') {
        throw e;
      }
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  // Every spec file loads the app's own client again (Vitest isolates the files), each with its own
  // connection pool: close it, or the files together run PostgreSQL out of connections ("too many
  // clients already"). Imported here, not at the top, so it is the instance the spec file used and
  // the test database is chosen before it is created. A spec file that mocks the module has no pool to
  // close (and Vitest throws on reading an export its mock doesn't define).
  const appPrisma = await import('./services/prisma');
  let client: { $disconnect?: () => Promise<void> } | undefined;
  try {
    client = appPrisma.prismaUnscoped;
  } catch {
    return;
  }
  await client?.$disconnect?.();
});
