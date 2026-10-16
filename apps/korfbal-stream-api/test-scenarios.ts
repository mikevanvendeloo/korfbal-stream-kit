import {Prisma, PrismaClient} from '@prisma/client';
import {runWithOrganization} from './src/services/organizationContext';

/**
 * Ready-made test data for integration and e2e tests: a match with a production, its callsheet items
 * (LIVE events) and positions, and a cleanup that removes it all again. Only needs a PrismaClient on the
 * TEST database, so the API's Vitest suites and the Playwright e2e tests share it.
 *
 * Start from the defaults and only pass what a test is about:
 *
 *   const show = await createProductionScenario(prisma, {active: true});
 *   ...
 *   await show.cleanup();
 */
export type ScenarioItem = {
  title: string;
  durationSec?: number;
  /** Position names; created when missing (and then removed again by cleanup) */
  positions?: string[];
  status?: 'WAITING' | 'ACTIVE' | 'COMPLETED';
  autoAdvance?: boolean;
  isInVenue?: boolean;
  isInLivestream?: boolean;
};

export type ScenarioOptions = {
  /** Organization the scenario belongs to (default: the test organization, see TEST_ORGANIZATION_SLUG) */
  organizationId?: number;
  /** Make this the active production (LIVE follows it); the others are switched off and back on by cleanup */
  active?: boolean;
  /** Match fields to override, e.g. {homeTeamName, refereeName, date} */
  match?: Partial<Prisma.MatchScheduleUncheckedCreateInput>;
  /** Callsheet items in show order; planned back to back from `startsAt` */
  items?: ScenarioItem[];
  /** When the first item is planned (default: one minute from now) */
  startsAt?: Date;
  /** Production segments, in order (name and minutes) */
  segments?: Array<{ naam: string; duurInMinuten: number }>;
  report?: Partial<Prisma.ProductionReportUncheckedCreateWithoutProductionInput>;
};

export const DEFAULT_ITEMS: ScenarioItem[] = [
  {title: 'Livestream starten', positions: ['Scenario Regie']},
  {title: 'Presentator heet welkom', positions: ['Scenario Regie']},
  {title: 'Opkomst spelers', positions: ['Scenario Camera']},
  {title: 'Afsluiting', positions: ['Scenario Regie']},
];

export type ProductionScenario = {
  productionId: number;
  matchId: number;
  /** Event ids in the order of `items` */
  eventIds: string[];
  /** Position id per name */
  positionIds: Record<string, number>;
  organizationId: number;
  cleanup: () => Promise<void>;
};

/** Slug of the organization tests run in: the global test setup creates it, the API tests send it as X-Organization. */
export const TEST_ORGANIZATION_SLUG = 'test-org';

/** Id of an organization by slug, created when missing (default: the test organization). */
export async function ensureOrganization(db: PrismaClient, slug = TEST_ORGANIZATION_SLUG, name = slug): Promise<number> {
  return (await db.organization.upsert({where: {slug}, update: {}, create: {slug, name}, select: {id: true}})).id;
}

/** The season containing a date (1 July – 30 June); created when the database lacks it. */
export async function seasonForDate(db: PrismaClient, date: Date) {
  const startYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return db.season.upsert({where: {startYear}, update: {}, create: {startYear, name: `${startYear}/${startYear + 1}`}});
}

let counter = 0;

export async function createProductionScenario(db: PrismaClient, options: ScenarioOptions = {}): Promise<ProductionScenario> {
  const organizationId = options.organizationId ?? await ensureOrganization(db);
  // Works with the app's scoped client (context) and with a plain client (explicit organizationId)
  return runWithOrganization(organizationId, () => buildScenario(db, organizationId, options));
}

async function buildScenario(db: PrismaClient, organizationId: number, options: ScenarioOptions): Promise<ProductionScenario> {
  const items = options.items ?? DEFAULT_ITEMS;
  const previouslyActive = options.active
    ? (await db.production.findMany({where: {organizationId, isActive: true}, select: {id: true}})).map((p) => p.id)
    : [];
  if (options.active) await db.production.updateMany({where: {organizationId, isActive: true}, data: {isActive: false}});

  // Positions: reuse existing ones, remember the ones this scenario creates
  const positionIds: Record<string, number> = {};
  const createdPositions: number[] = [];
  for (const name of new Set(items.flatMap((i) => i.positions ?? []))) {
    const existing = await db.position.findFirst({where: {organizationId, name}});
    const position = existing ?? await db.position.create({data: {organizationId, name}});
    if (!existing) createdPositions.push(position.id);
    positionIds[name] = position.id;
  }

  const date = options.match?.date ? new Date(options.match.date as Date) : new Date();
  const match = await db.matchSchedule.create({
    data: {
      seasonId: (await seasonForDate(db, date)).id,
      externalId: `scenario-${Date.now()}-${++counter}`,
      homeTeamName: 'Scenario Thuis',
      awayTeamName: 'Scenario Uit',
      isHomeMatch: true,
      ...options.match,
      organizationId,
      date,
    },
  });
  const production = await db.production.create({
    data: {
      organizationId,
      matchScheduleId: match.id,
      isActive: !!options.active,
      ...(options.report ? {productionReport: {create: {...options.report, organizationId}}} : {}),
      ...(options.segments ? {segments: {create: options.segments.map((s, i) => ({...s, volgorde: i + 1, organizationId}))}} : {}),
    },
  });

  let plannedStart = (options.startsAt ?? new Date(Date.now() + 60_000)).getTime();
  const eventIds: string[] = [];
  for (const [i, item] of items.entries()) {
    const durationSec = item.durationSec ?? 120;
    const event = await db.productionEvent.create({
      data: {
        organizationId,
        productionId: production.id, order: i + 1, title: item.title, durationSec,
        status: item.status ?? 'WAITING', autoAdvance: item.autoAdvance ?? false,
        isInVenue: item.isInVenue ?? false, isInLivestream: item.isInLivestream ?? true,
        plannedStartTime: new Date(plannedStart), plannedEndTime: new Date(plannedStart + durationSec * 1000),
        positions: {create: (item.positions ?? []).map((name) => ({positionId: positionIds[name], organizationId}))},
      },
    });
    eventIds.push(event.id);
    plannedStart += durationSec * 1000;
  }

  return {
    productionId: production.id,
    matchId: match.id,
    eventIds,
    positionIds,
    organizationId,
    cleanup: () => runWithOrganization(organizationId, async () => {
      await db.production.deleteMany({where: {organizationId, id: production.id}});
      await db.matchSchedule.deleteMany({where: {organizationId, id: match.id}});
      if (createdPositions.length) await db.position.deleteMany({where: {organizationId, id: {in: createdPositions}}});
      if (previouslyActive.length) await db.production.updateMany({where: {organizationId, id: {in: previouslyActive}}, data: {isActive: true}});
    }),
  };
}
