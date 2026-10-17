import {PrismaClient} from '@prisma/client';
import {vi} from 'vitest';
import {ACTIVE_SEASON_ID_KEY, clearSeasonCache, ensureSeasonForDate, seasonNameForStartYear} from './src/services/season';
import {clearSettingsCache} from './src/services/appSettings';
import {prisma as appPrisma, prismaUnscoped} from './src/services/prisma';
import {tenantScope} from './src/services/tenantScope';
import {applyStandardSet} from './src/services/standardSet';
import {getOrganizationId, runWithOrganization} from './src/services/organizationContext';
import {ensureOrganization} from './test-scenarios';

export {ensureOrganization, TEST_ORGANIZATION_SLUG} from './test-scenarios';

let testOrganization: number | undefined;

/** Id of the test organization (created by the global test setup; created here when missing). */
export async function testOrganizationId(): Promise<number> {
  testOrganization ??= await ensureOrganization(appPrisma);
  return testOrganization;
}

/** Gives the test organization the standard set (skills, positions, templates), like a new organization gets. */
export async function applyStandardSetToTestOrganization() {
  return applyStandardSet(await testOrganizationId());
}

/** Runs `fn` as the test organization, e.g. to call services that query tenant tables directly. */
export async function inTestOrganization<T>(fn: () => Promise<T>): Promise<T> {
  const organizationId = await testOrganizationId();
  return runWithOrganization(organizationId, fn);
}

/** Runs `fn` as the organization with this slug (created when missing). */
export async function inOrganization<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  const organizationId = await ensureOrganization(appPrisma, slug);
  return runWithOrganization(organizationId, fn);
}

/**
 * The app's (scoped) Prisma client for test setup: queries without an organization in the context run
 * as the test organization. Application code always uses the strict client from src/services/prisma.
 */
// Query extensions run in the order they were added: first the default organization, then the scope.
export const testDb = prismaUnscoped.$extends({
  query: {
    $allModels: {
      async $allOperations({args, query}) {
        if (getOrganizationId() !== undefined) return query(args);
        const organizationId = await testOrganizationId();
        return runWithOrganization(organizationId, () => query(args));
      },
    },
  },
}).$extends(tenantScope) as unknown as PrismaClient;

/** Marks a supertest request to go out without the X-Organization header test-setup.ts adds by default. */
export function withoutOrganization<T extends object>(test: T): T {
  (test as {withoutOrganization?: boolean}).withoutOrganization = true;
  return test;
}

/**
 * Cleans all data from the test database by truncating all tables.
 * This is much faster than deleting from each table individually.
 * @param prisma The PrismaClient instance connected to the test database.
 */
export async function cleanDatabase(prisma: PrismaClient) {
  // This logic is for PostgreSQL. If you use a different database,
  // you will need to adjust the query to get table names.
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tablesToTruncate = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations'); // Don't truncate the migrations table

  if (tablesToTruncate.length === 0) {
    return;
  }

  const truncateQuery = `TRUNCATE TABLE ${tablesToTruncate
    .map((name) => `"${name}"`)
    .join(', ')} RESTART IDENTITY CASCADE;`;

  await prisma.$executeRawUnsafe(truncateQuery);
  clearSeasonCache();
  clearSettingsCache();
  // Organizations went too (they reference clubs): bring the test organization back
  testOrganization = undefined;
  await testOrganizationId();
}

/**
 * Id of the season containing "today" (created when missing). Matches must belong to a season,
 * and season-scoped list endpoints default to the current season.
 */
export async function currentSeasonId(prisma: PrismaClient): Promise<number> {
  return (await ensureSeasonForDate(new Date(), prisma)).id;
}

export interface SeasonMockState {
  seasons: Array<{ id: number; startYear: number; name: string; createdAt: Date }>;
  settings: Map<string, unknown>;
  counts: Map<number, { matches: number; players: number }>;
}

/**
 * Installs in-memory `season` and `setting` delegates on a (mocked) Prisma client for unit tests.
 */
export function installSeasonMocks(
  prisma: any,
  initial: { startYears?: number[]; activeStartYear?: number } = {},
): SeasonMockState {
  clearSettingsCache();
  clearSeasonCache();
  const state: SeasonMockState = {seasons: [], settings: new Map(), counts: new Map()};
  const withCounts = (s: SeasonMockState['seasons'][number], include?: any) =>
    include?._count ? {...s, _count: state.counts.get(s.id) ?? {matches: 0, players: 0}} : {...s};
  const matches = (s: SeasonMockState['seasons'][number], where: any = {}) =>
    (where.id === undefined || s.id === where.id) &&
    (where.startYear === undefined || s.startYear === where.startYear) &&
    (where.name === undefined || s.name === where.name);
  const create = (data: { startYear: number; name: string }) => {
    if (state.seasons.some((s) => s.startYear === data.startYear || s.name === data.name)) {
      throw Object.assign(new Error('Unique constraint failed'), {code: 'P2002'});
    }
    const row = {id: (state.seasons.at(-1)?.id ?? 0) + 1, createdAt: new Date('2026-01-01T00:00:00Z'), ...data};
    state.seasons.push(row);
    return row;
  };

  prisma.season = {
    findUnique: vi.fn(async ({where, include}: any) => {
      const s = state.seasons.find((row) => matches(row, where));
      return s ? withCounts(s, include) : null;
    }),
    findFirst: vi.fn(async ({where, orderBy}: any = {}) => {
      const rows = state.seasons.filter((row) => matches(row, where));
      if (orderBy?.startYear === 'desc') rows.sort((a, b) => b.startYear - a.startYear);
      return rows[0] ?? null;
    }),
    findMany: vi.fn(async ({orderBy, include}: any = {}) => {
      const rows = [...state.seasons];
      if (orderBy?.startYear === 'desc') rows.sort((a, b) => b.startYear - a.startYear);
      return rows.map((s) => withCounts(s, include));
    }),
    create: vi.fn(async ({data}: any) => create(data)),
    upsert: vi.fn(async ({where, create: data}: any) => state.seasons.find((row) => matches(row, where)) ?? create(data)),
    delete: vi.fn(async ({where}: any) => {
      const idx = state.seasons.findIndex((row) => row.id === where.id);
      if (idx < 0) throw new Error('Not found');
      return state.seasons.splice(idx, 1)[0];
    }),
  };

  prisma.setting = {
    findUnique: vi.fn(async ({where}: any) => (state.settings.has(where.key) ? {key: where.key, value: state.settings.get(where.key)} : null)),
    upsert: vi.fn(async ({where, create: data}: any) => {
      state.settings.set(where.key, data.value);
      return {key: where.key, value: data.value};
    }),
  };
  // Organization settings share the map: unit tests run as one organization
  prisma.organizationSetting = {
    findFirst: vi.fn(async ({where}: any) => (state.settings.has(where.key) ? {key: where.key, value: state.settings.get(where.key)} : null)),
    upsert: vi.fn(async ({where, create: data}: any) => {
      state.settings.set(where.organizationId_key.key, data.value);
      return {key: where.organizationId_key.key, value: data.value};
    }),
  };

  for (const startYear of initial.startYears ?? []) create({startYear, name: seasonNameForStartYear(startYear)});
  if (initial.activeStartYear !== undefined) {
    const active = state.seasons.find((s) => s.startYear === initial.activeStartYear)
      ?? create({startYear: initial.activeStartYear, name: seasonNameForStartYear(initial.activeStartYear)});
    state.settings.set(ACTIVE_SEASON_ID_KEY, active.id);
  }
  return state;
}

type QueryListener = (query: string) => void;
const queryListeners = new Set<QueryListener>();
let listeningToQueries = false;

/**
 * The SQL the app sends to the database while `fn` runs (Prisma's query events), e.g. to check that a
 * loop needs no query when nothing changes. Also sees queries of other code running at the same time.
 */
export async function recordQueries(fn: () => Promise<unknown>): Promise<string[]> {
  if (!listeningToQueries) {
    prismaUnscoped.$on('query' as never, (event: {query: string}) => queryListeners.forEach((listener) => listener(event.query)));
    listeningToQueries = true;
  }
  const queries: string[] = [];
  const listener: QueryListener = (query) => queries.push(query);
  queryListeners.add(listener);
  try {
    await fn();
    await new Promise((resolve) => setImmediate(resolve)); // query events of the last query
  } finally {
    queryListeners.delete(listener);
  }
  return queries;
}
