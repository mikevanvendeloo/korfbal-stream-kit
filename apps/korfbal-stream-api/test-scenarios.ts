import {AsyncLocalStorage} from 'node:async_hooks';
import {Prisma, PrismaClient} from '@prisma/client';

/**
 * Runs `fn` in the organization context of the API (src/services/organizationContext.ts), through the
 * same process-wide storage, without importing it: the e2e tests use this file too and only pass a
 * plain client (every create below sets organizationId explicitly as well).
 */
function runWithOrganization<T>(organizationId: number, fn: () => Promise<T>): Promise<T> {
  const holder = globalThis as unknown as Record<symbol, AsyncLocalStorage<{organizationId: number}> | undefined>;
  const storage = (holder[Symbol.for('korfbal-stream.organization-context')] ??= new AsyncLocalStorage<{organizationId: number}>());
  return storage.run({organizationId}, fn);
}

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

/** Ids of one of everything an organization owns, made by createTenantScenario. */
export type TenantScenario = {
  organizationId: number;
  /** Text in every name/title, so a test can tell whether a response shows this organization's data */
  marker: string;
  productionId: number;
  matchId: number;
  manualMatchId: number;
  segmentId: number;
  eventId: string;
  positionId: number;
  linkedPositionId: number;
  skillId: number;
  personId: number;
  sponsorId: number;
  matchAssignmentId: number;
  productionPersonId: number;
  personPositionId: number;
  segmentAssignmentId: number;
  callSheetId: number;
  callSheetItemId: string;
  callSheetTemplateId: number;
  callSheetTemplateItemId: string;
  segmentTemplateId: number;
  segmentTemplateItemId: number;
  titleId: number;
  titleTemplateId: number;
  clubId: number;
  playerId: number;
  cleanup: () => Promise<void>;
};

/**
 * One of every tenant row (production with segments, events, callsheet, crew, report and interview;
 * match with a role assignment; sponsor, person, skill, positions with a link, templates, title
 * templates, a manual match), all named with `marker`. For isolation tests: build it in one
 * organization and look at it from another.
 */
export async function createTenantScenario(db: PrismaClient, organizationId: number, marker: string): Promise<TenantScenario> {
  const show = await createProductionScenario(db, {
    organizationId,
    items: [{title: `${marker} opening`, positions: [`${marker} Regie`]}],
    match: {homeTeamName: `${marker} Thuis`, awayTeamName: `${marker} Uit`},
    segments: [{naam: `${marker} Wedstrijd`, duurInMinuten: 60}],
    report: {matchSponsor: `${marker} sponsor`, remarks: `${marker} opmerking`},
  });
  return runWithOrganization(organizationId, async () => {
    const o = {organizationId};
    const positionId = show.positionIds[`${marker} Regie`];
    const skill = await db.skill.create({data: {...o, code: `${marker.toUpperCase()}_SKILL`, name: `${marker} skill`, nameMale: `${marker} m`, nameFemale: `${marker} v`}});
    const linked = await db.position.create({data: {...o, name: `${marker} Camera`, skillId: skill.id}});
    await db.positionLink.create({data: {...o, sourcePositionId: positionId, targetPositionId: linked.id}});
    const person = await db.person.create({data: {...o, name: `${marker} Persoon`, gender: 'female'}});
    await db.personSkill.create({data: {...o, personId: person.id, skillId: skill.id}});
    const sponsor = await db.sponsor.create({data: {...o, name: `${marker} Sponsor`, type: 'premium', logoUrl: `${marker.toLowerCase()}.png`, websiteUrl: 'https://example.com'}});
    const assignment = await db.matchRoleAssignment.create({data: {...o, matchScheduleId: show.matchId, personId: person.id, skillId: skill.id}});
    const manual = await db.matchSchedule.create({
      data: {...o, seasonId: (await seasonForDate(db, new Date())).id, isManual: true, date: new Date(), homeTeamName: `${marker} Handmatig`, awayTeamName: `${marker} Gast`},
    });
    const segment = await db.productionSegment.findFirstOrThrow({where: {organizationId, productionId: show.productionId}});
    const productionPerson = await db.productionPerson.create({data: {...o, productionId: show.productionId, personId: person.id}});
    const personPosition = await db.productionPersonPosition.create({data: {...o, productionId: show.productionId, personId: person.id, positionId}});
    const segmentAssignment = await db.segmentRoleAssignment.create({data: {...o, productionSegmentId: segment.id, personId: person.id, positionId}});
    const callSheet = await db.callSheet.create({data: {...o, productionId: show.productionId, name: `${marker} Callsheet`}});
    const callSheetItem = await db.callSheetItem.create({
      data: {...o, id: `${marker.toLowerCase()}-item-${Date.now()}`, callSheetId: callSheet.id, cue: 'C1', title: `${marker} item`, durationSec: 60,
        positions: {create: [{...o, positionId}]}},
    });
    const template = await db.callSheetTemplate.create({data: {...o, name: `${marker} Draaiboek`}});
    const templateItem = await db.callSheetTemplateItem.create({
      data: {...o, templateId: template.id, title: `${marker} sjabloonitem`, durationSec: 60, positions: {create: [{...o, positionId}]}},
    });
    const segmentTemplate = await db.segmentTemplate.create({data: {...o, name: `${marker} Segmenten`}});
    const segmentTemplateItem = await db.segmentTemplateItem.create({data: {...o, templateId: segmentTemplate.id, naam: `${marker} Segment`, volgorde: 1, duurInMinuten: 30}});
    await db.segmentDefaultPosition.create({data: {...o, segmentName: `${marker} Wedstrijd`, positionId, order: 1}});
    const title = await db.titleDefinition.create({
      data: {...o, productionId: show.productionId, name: `${marker} titel`, parts: {create: [{...o, sourceType: 'FREE_TEXT', customName: `${marker} naam`}]}},
    });
    const titleTemplate = await db.titleDefinition.create({
      data: {...o, productionId: null, name: `${marker} titelsjabloon`, parts: {create: [{...o, sourceType: 'COMMENTARY'}]}},
    });
    const club = await db.club.create({data: {name: `${marker} Club`, shortName: marker, slug: `${marker.toLowerCase()}-club-${Date.now()}`}});
    const player = await db.player.create({data: {clubId: club.id, seasonId: manual.seasonId, name: `${marker} Speler`}});
    await db.interviewSubject.create({data: {...o, productionId: show.productionId, side: 'HOME', role: 'PLAYER', playerId: player.id, titleDefinitionId: title.id}});

    return {
      organizationId, marker,
      productionId: show.productionId, matchId: show.matchId, manualMatchId: manual.id, segmentId: segment.id, eventId: show.eventIds[0],
      positionId, linkedPositionId: linked.id, skillId: skill.id, personId: person.id, sponsorId: sponsor.id,
      matchAssignmentId: assignment.id, productionPersonId: productionPerson.id, personPositionId: personPosition.id,
      segmentAssignmentId: segmentAssignment.id, callSheetId: callSheet.id, callSheetItemId: callSheetItem.id,
      callSheetTemplateId: template.id, callSheetTemplateItemId: templateItem.id, segmentTemplateId: segmentTemplate.id,
      segmentTemplateItemId: segmentTemplateItem.id, titleId: title.id, titleTemplateId: titleTemplate.id,
      clubId: club.id, playerId: player.id,
      // Removes the organization too (cascading to everything in it): use one made for the test
      cleanup: async () => {
        await show.cleanup();
        await db.club.deleteMany({where: {id: club.id}});
        await db.organization.deleteMany({where: {id: organizationId, slug: {not: TEST_ORGANIZATION_SLUG}}});
      },
    };
  });
}
