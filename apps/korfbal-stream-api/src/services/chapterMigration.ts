import type {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {runWithOrganization} from './organizationContext';
import {getSetting, setSetting} from './appSettings';
import {placeItemsInChapters, segmentWindows, sequentialStarts, type ChapterWindow, type Placement} from './chapters';
import {logger} from '../utils/logger';

/**
 * Migration of segments into hoofdstukken (openspec/changes/chapters D7). Idempotent: only items,
 * events and templates without a hoofdstuk are touched. Runs at startup per organization, and after
 * every write that creates items without one (apply template, sync to LIVE, restore, import) until
 * those write paths set the hoofdstuk themselves (phase 3).
 */

type Tx = Prisma.TransactionClient;

const MINUTE = 60_000;
/** The default liveTime of a new production: 5 minutes before the match (routes/production.ts) */
const DEFAULT_LIVE_BEFORE_MATCH = 5 * MINUTE;
const VOORBEREIDING = 'Voorbereiding';
/** A production with items but without segments gets one hoofdstuk */
const DRAAIBOEK = 'Draaiboek';
/** Once per organization: other segment templates were kept as templates with hoofdstukken only */
const SEGMENT_TEMPLATES_CONVERTED_KEY = 'chaptersSegmentTemplatesConverted';

type ProductionResult = { items: number; events: number; created: string[] };

/** Inserts a hoofdstuk at the front of a production (volgorde 1), moving the others one place on. */
async function insertFirstChapter(tx: Tx, productionId: number, naam: string): Promise<number> {
  // Two phases, as the segment reorders do: volgorde is unique per production
  await tx.productionChapter.updateMany({where: {productionId}, data: {volgorde: {increment: 1000}}});
  await tx.productionChapter.updateMany({where: {productionId}, data: {volgorde: {decrement: 999}}});
  return (await tx.productionChapter.create({data: {productionId, naam, volgorde: 1, duurInMinuten: 0}})).id;
}

/**
 * Puts the items and LIVE events of one production without a hoofdstuk into the hoofdstuk whose
 * window holds their start (windows: the segments anchored at the kickoff; item starts: laid out from
 * the match start anchor). `flag` marks a production with a match from now on for checking in Beheer.
 */
export async function placeProductionChapters(tx: Tx, productionId: number, {flag = false}: { flag?: boolean } = {}): Promise<ProductionResult> {
  const result: ProductionResult = {items: 0, events: 0, created: []};
  const production = await tx.production.findUnique({
    where: {id: productionId},
    include: {
      matchSchedule: {select: {date: true}},
      segments: {orderBy: {volgorde: 'asc'}},
      callSheets: {include: {items: {orderBy: {orderIndex: 'asc'}}}},
    },
  });
  if (!production) return result;
  const events = await tx.productionEvent.findMany({where: {productionId, chapterId: null}, orderBy: {order: 'asc'}});
  const loose = production.callSheets.flatMap((cs) => cs.items).filter((it) => it.productionSegmentId == null);
  if (loose.length === 0 && events.length === 0) return result;

  const kickoff = production.matchSchedule.date.getTime();
  const anchorTimes = {MATCH_START: kickoff, LIVESTREAM_START: production.liveTime?.getTime() ?? kickoff - DEFAULT_LIVE_BEFORE_MATCH};
  let segments = production.segments;
  if (segments.length === 0) {
    const id = (await tx.productionChapter.create({data: {productionId, naam: DRAAIBOEK, volgorde: 1, duurInMinuten: 0}})).id;
    segments = await tx.productionChapter.findMany({where: {id}});
    result.created.push(DRAAIBOEK);
  }
  // One segment (e.g. the Draaiboek fallback) holds everything
  const windows: ChapterWindow<number>[] = segments.length === 1
    ? [{key: segments[0].id, start: -Infinity, end: Infinity}]
    : segmentWindows(segments.map((s) => ({key: s.id, duurInMinuten: s.duurInMinuten, isTimeAnchor: s.isTimeAnchor})), kickoff);

  let voorbereidingId: number | null = null;
  const chapterOf = async (place: Placement<number>): Promise<number> => {
    if (place !== 'BEFORE') return place;
    if (voorbereidingId == null) {
      voorbereidingId = await insertFirstChapter(tx, productionId, VOORBEREIDING);
      result.created.push(VOORBEREIDING);
    }
    return voorbereidingId;
  };

  // Items, per callsheet in show order; items that already have a hoofdstuk keep it
  const itemChapter = new Map<string, number>();
  for (const cs of production.callSheets) {
    for (const it of cs.items) if (it.productionSegmentId != null) itemChapter.set(it.id, it.productionSegmentId);
    // Laid out from the anchor (the kickoff, like the segments); without an anchor the stored times count
    const starts: Map<string, number | null> = cs.items.some((it) => it.isTimeAnchor)
      ? sequentialStarts(cs.items, anchorTimes)
      : new Map(cs.items.map((it) => [it.id, it.timeStart?.getTime() ?? null]));
    const placement = placeItemsInChapters(windows, cs.items.map((it) => ({id: it.id, start: starts.get(it.id) ?? null, parentId: it.parentId})));
    for (const it of cs.items) {
      if (it.productionSegmentId != null) continue;
      const chapterId = await chapterOf(placement.get(it.id) ?? windows[0].key);
      await tx.callSheetItem.update({where: {id: it.id}, data: {productionSegmentId: chapterId}});
      itemChapter.set(it.id, chapterId);
      result.items++;
    }
  }

  // Events: the hoofdstuk of their callsheet item, else by their planned start
  const eventPlacement = placeItemsInChapters(windows, events.map((ev) => ({id: ev.id, start: ev.plannedStartTime?.getTime() ?? null, parentId: ev.parentId})));
  for (const ev of events) {
    const chapterId = (ev.callSheetItemId ? itemChapter.get(ev.callSheetItemId) : undefined)
      ?? await chapterOf(eventPlacement.get(ev.id) ?? windows[0].key);
    await tx.productionEvent.update({where: {id: ev.id}, data: {chapterId}});
    result.events++;
  }

  if (flag && (result.items > 0 || result.events > 0) && production.matchSchedule.date.getTime() >= Date.now()) {
    await tx.production.update({where: {id: productionId}, data: {chaptersAutoPlaced: true}});
  }
  return result;
}

type SegmentShape = { naam: string; volgorde: number; duurInMinuten: number; isTimeAnchor: boolean };

/**
 * Gives a draaiboek template without hoofdstukken the hoofdstukken of the organization's default
 * segment template, with its items placed by time (relative to the match start) and the standard
 * positions by segment name. Items without a hoofdstuk in a template that has some take the hoofdstuk
 * of the item before them.
 */
export async function placeTemplateChapters(
  tx: Tx,
  templateId: number,
  segments: SegmentShape[],
  defaultPositions: Array<{ segmentName: string; positionId: number; order: number }>,
): Promise<{ items: number; created: string[] }> {
  const template = await tx.callSheetTemplate.findUnique({
    where: {id: templateId},
    include: {chapters: {orderBy: {orderIndex: 'asc'}}, items: {orderBy: {orderIndex: 'asc'}}},
  });
  const result = {items: 0, created: [] as string[]};
  if (!template) return result;
  const loose = template.items.filter((it) => it.chapterId == null);
  if (template.chapters.length > 0) {
    // Already has hoofdstukken: a loose item joins the hoofdstuk of the item before it
    let previous = template.chapters[0].id;
    for (const it of template.items) {
      if (it.chapterId) previous = it.chapterId;
      else {
        await tx.callSheetTemplateItem.update({where: {id: it.id}, data: {chapterId: previous}});
        result.items++;
      }
    }
    return result;
  }

  const ordered = [...segments].sort((a, b) => a.volgorde - b.volgorde);
  const names = ordered.length > 0 ? ordered.map((s) => s.naam) : [DRAAIBOEK];
  const windows: ChapterWindow<string>[] = ordered.length > 1
    ? segmentWindows(ordered.map((s) => ({key: s.naam, duurInMinuten: s.duurInMinuten, isTimeAnchor: s.isTimeAnchor})), 0)
    : [{key: names[0], start: -Infinity, end: Infinity}];
  const starts = sequentialStarts(template.items, {MATCH_START: 0, LIVESTREAM_START: -DEFAULT_LIVE_BEFORE_MATCH});
  const placement = placeItemsInChapters(windows, template.items.map((it) => ({id: it.id, start: starts.get(it.id) ?? null, parentId: it.parentId})));
  const hasBefore = [...placement.values()].includes('BEFORE');

  const chapterNames = [...(hasBefore ? [VOORBEREIDING] : []), ...names];
  const chapterIds = new Map<string, string>();
  for (const [orderIndex, name] of chapterNames.entries()) {
    const positions = defaultPositions.filter((p) => p.segmentName === name).sort((a, b) => a.order - b.order);
    const chapter = await tx.callSheetTemplateChapter.create({
      data: {templateId, name, orderIndex, positions: {create: positions.map((p, i) => ({positionId: p.positionId, orderIndex: i}))}},
    });
    chapterIds.set(name, chapter.id);
    result.created.push(name);
  }
  for (const it of loose) {
    const place = placement.get(it.id) ?? names[0];
    await tx.callSheetTemplateItem.update({where: {id: it.id}, data: {chapterId: chapterIds.get(place === 'BEFORE' ? VOORBEREIDING : place)}});
    result.items++;
  }
  if (template.items.length > 0) await tx.callSheetTemplate.update({where: {id: templateId}, data: {chaptersAutoPlaced: true}});
  return result;
}

/** The organization's default segment template (isDefault, else the first), with its items. */
async function defaultSegmentTemplate() {
  return prisma.segmentTemplate.findFirst({
    orderBy: [{isDefault: 'desc'}, {id: 'asc'}],
    include: {items: {orderBy: {volgorde: 'asc'}}},
  });
}

/** Migrates the organization in the context: productions, draaiboek templates and, once, the other segment templates. */
export async function migrateOrganizationChapters(): Promise<{ productions: number; templates: number; keptSegmentTemplates: number }> {
  const summary = {productions: 0, templates: 0, keptSegmentTemplates: 0};

  const productionIds = await prisma.production.findMany({
    where: {OR: [{callSheets: {some: {items: {some: {productionSegmentId: null}}}}}, {productionEvents: {some: {chapterId: null}}}]},
    select: {id: true},
  });
  for (const {id} of productionIds) {
    const placed = await prisma.$transaction((tx) => placeProductionChapters(tx, id, {flag: true}));
    if (placed.items + placed.events > 0) summary.productions++;
  }

  const segmentTemplate = await defaultSegmentTemplate();
  const defaultPositions = await prisma.segmentDefaultPosition.findMany({select: {segmentName: true, positionId: true, order: true}});
  const templates = await prisma.callSheetTemplate.findMany({
    where: {OR: [{chapters: {none: {}}}, {items: {some: {chapterId: null}}}]},
    select: {id: true},
  });
  for (const {id} of templates) {
    const placed = await prisma.$transaction((tx) => placeTemplateChapters(tx, id, segmentTemplate?.items ?? [], defaultPositions));
    if (placed.items > 0 || placed.created.length > 0) summary.templates++;
  }

  // The other segment templates become draaiboek templates with only hoofdstukken, once, so nothing is lost
  if (!(await getSetting<boolean>(SEGMENT_TEMPLATES_CONVERTED_KEY))) {
    const others = await prisma.segmentTemplate.findMany({
      where: segmentTemplate ? {id: {not: segmentTemplate.id}} : {},
      include: {items: {orderBy: {volgorde: 'asc'}}},
    });
    for (const other of others) {
      const name = `${other.name} (hoofdstukken)`;
      if (await prisma.callSheetTemplate.findFirst({where: {name}})) continue;
      await prisma.$transaction(async (tx) => {
        const template = await tx.callSheetTemplate.create({data: {name}});
        await placeTemplateChapters(tx, template.id, other.items, defaultPositions);
      });
      summary.keptSegmentTemplates++;
    }
    await setSetting(SEGMENT_TEMPLATES_CONVERTED_KEY, true);
  }
  return summary;
}

/** At startup: every organization, each in its own context; a failing organization doesn't stop the others. */
export async function migrateAllChapters(): Promise<void> {
  const organizations = await prisma.organization.findMany({select: {id: true, slug: true}});
  for (const organization of organizations) {
    try {
      const summary = await runWithOrganization(organization.id, () => migrateOrganizationChapters());
      if (summary.productions || summary.templates || summary.keptSegmentTemplates) {
        logger.info(`Hoofdstukken placed for organization ${organization.slug}`, summary);
      }
    } catch (err) {
      logger.error(`Placing hoofdstukken failed for organization ${organization.slug}`, err as Error);
    }
  }
}
