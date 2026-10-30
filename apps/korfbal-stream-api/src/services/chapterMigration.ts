import type {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {runWithOrganization} from './organizationContext';
import {getSetting, setSetting} from './appSettings';
import {placeItemsInChapters, segmentWindows, sequentialStarts, type ChapterWindow, type Placement} from './chapters';
import {logger} from '../utils/logger';

/**
 * Older backups and production exports (before hoofdstukken, openspec/changes/chapters D7) have segments
 * with a duration and an anchor, and items without a segment. On restore those items first go into a
 * holding hoofdstuk (every item needs one), and are then placed here into the hoofdstuk whose window
 * holds their start: the segments anchored at the kickoff, item starts laid out from the match start
 * anchor. Items before the first window get a new hoofdstuk *Voorbereiding* at the front.
 */

type Tx = Prisma.TransactionClient;

const MINUTE = 60_000;
/** The default liveTime of a new production: 5 minutes before the match (routes/production.ts) */
const DEFAULT_LIVE_BEFORE_MATCH = 5 * MINUTE;
const VOORBEREIDING = 'Voorbereiding';
/** Once per organization: other segment templates were kept as templates with hoofdstukken only */
const SEGMENT_TEMPLATES_CONVERTED_KEY = 'chaptersSegmentTemplatesConverted';
/**
 * Once per organization: its productions and templates were placed. From then on the API puts every new
 * item and event in a hoofdstuk, so later starts only tidy up strays and never flag or add hoofdstukken.
 */
const CHAPTERS_MIGRATED_KEY = 'chaptersMigrated';
/** The holding hoofdstuk of a restore; it stays when the file has no segments to place the items in */
export const DRAAIBOEK = 'Draaiboek';

/** A segment of an older file: the hoofdstuk it became, with its old duration and anchor. */
export type LegacySegment = { chapterId: number; duurInMinuten: number; isTimeAnchor: boolean };

type PlacementResult = { items: number; events: number; created: string[] };

/** Inserts a hoofdstuk at the front of a production (orderIndex 1), moving the others one place on. */
async function insertFirstChapter(tx: Tx, productionId: number, name: string): Promise<number> {
  // Two phases: orderIndex is unique per production
  await tx.productionChapter.updateMany({where: {productionId}, data: {orderIndex: {increment: 1000}}});
  await tx.productionChapter.updateMany({where: {productionId}, data: {orderIndex: {decrement: 999}}});
  return (await tx.productionChapter.create({data: {productionId, name, orderIndex: 1}})).id;
}

/**
 * Places the items in `holdingChapterId` and the events without a hoofdstuk of one production by the
 * old segments' windows. The holding hoofdstuk is removed when it ends up empty. `flag` marks a
 * production with a match from now on for checking in Beheer.
 */
export async function placeLegacyItems(
  tx: Tx,
  productionId: number,
  {segments, holdingChapterId, flag = true}: { segments: LegacySegment[]; holdingChapterId: number | null; flag?: boolean },
): Promise<PlacementResult> {
  const result: PlacementResult = {items: 0, events: 0, created: []};
  const production = await tx.production.findUnique({
    where: {id: productionId},
    include: {matchSchedule: {select: {date: true}}, callSheets: {include: {items: {orderBy: {orderIndex: 'asc'}}}}},
  });
  if (!production) return result;
  const events = await tx.productionEvent.findMany({where: {productionId, chapterId: null}, orderBy: {order: 'asc'}});
  const held = production.callSheets.flatMap((cs) => cs.items).filter((it) => it.chapterId === holdingChapterId);
  if (held.length === 0 && events.length === 0) return result;

  const usable = segments.filter((s) => s.chapterId !== holdingChapterId);
  const fallback = usable[0]?.chapterId ?? holdingChapterId;
  if (fallback == null) return result;
  const kickoff = production.matchSchedule.date.getTime();
  const anchorTimes = {MATCH_START: kickoff, LIVESTREAM_START: production.liveTime?.getTime() ?? kickoff - DEFAULT_LIVE_BEFORE_MATCH};
  // One segment (or none: the holding Draaiboek) holds everything
  const windows: ChapterWindow<number>[] = usable.length > 1
    ? segmentWindows(usable.map((s) => ({key: s.chapterId, duurInMinuten: s.duurInMinuten, isTimeAnchor: s.isTimeAnchor})), kickoff)
    : [{key: fallback, start: -Infinity, end: Infinity}];

  let voorbereidingId: number | null = null;
  const chapterOf = async (place: Placement<number>): Promise<number> => {
    if (place !== 'BEFORE') return place;
    if (voorbereidingId == null) {
      voorbereidingId = await insertFirstChapter(tx, productionId, VOORBEREIDING);
      result.created.push(VOORBEREIDING);
    }
    return voorbereidingId;
  };

  // Items, per callsheet in show order; items that came with a hoofdstuk keep it
  const itemChapter = new Map<string, number>();
  for (const cs of production.callSheets) {
    for (const it of cs.items) if (it.chapterId != null) itemChapter.set(it.id, it.chapterId);
    // Laid out from the anchor (the kickoff, like the segments); without an anchor the stored times count
    const starts: Map<string, number | null> = cs.items.some((it) => it.isTimeAnchor)
      ? sequentialStarts(cs.items, anchorTimes)
      : new Map(cs.items.map((it) => [it.id, it.timeStart?.getTime() ?? null]));
    const placement = placeItemsInChapters(windows, cs.items.map((it) => ({id: it.id, start: starts.get(it.id) ?? null, parentId: it.parentId})));
    for (const it of cs.items) {
      if (it.chapterId !== holdingChapterId) continue;
      const chapterId = await chapterOf(placement.get(it.id) ?? fallback);
      if (chapterId !== it.chapterId) await tx.callSheetItem.update({where: {id: it.id}, data: {chapterId}});
      itemChapter.set(it.id, chapterId);
      result.items++;
    }
  }

  // Events: the hoofdstuk of their callsheet item, else by their planned start
  const eventPlacement = placeItemsInChapters(windows, events.map((ev) => ({id: ev.id, start: ev.plannedStartTime?.getTime() ?? null, parentId: ev.parentId})));
  for (const ev of events) {
    const chapterId = (ev.callSheetItemId ? itemChapter.get(ev.callSheetItemId) : undefined)
      ?? await chapterOf(eventPlacement.get(ev.id) ?? fallback);
    await tx.productionEvent.update({where: {id: ev.id}, data: {chapterId}});
    result.events++;
  }

  if (holdingChapterId != null && fallback !== holdingChapterId) {
    const left = await tx.callSheetItem.count({where: {chapterId: holdingChapterId}});
    if (left === 0) await tx.productionChapter.delete({where: {id: holdingChapterId}});
  }
  if (flag && (result.items > 0 || result.events > 0) && production.matchSchedule.date.getTime() >= Date.now()) {
    await tx.production.update({where: {id: productionId}, data: {chaptersAutoPlaced: true}});
  }
  return result;
}

/**
 * Startup migration (D7), until the follow-up release: the items and events without a hoofdstuk of one
 * production, placed by the windows of its segments (old durations and anchor). A production with
 * items but without segments gets one hoofdstuk *Draaiboek*.
 */
export async function placeProductionChapters(tx: Tx, productionId: number, {flag = false}: { flag?: boolean } = {}): Promise<PlacementResult> {
  let chapters = await tx.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}});
  if (chapters.length === 0) {
    const loose = await tx.callSheetItem.count({where: {callSheet: {productionId}, chapterId: null}})
      + await tx.productionEvent.count({where: {productionId, chapterId: null}});
    if (loose === 0) return {items: 0, events: 0, created: []};
    chapters = [await tx.productionChapter.create({data: {productionId, name: DRAAIBOEK, orderIndex: 1}})];
  }
  const segments = chapters.map((c) => ({chapterId: c.id, duurInMinuten: c.duurInMinuten, isTimeAnchor: c.isTimeAnchor}));
  return placeLegacyItems(tx, productionId, {segments, holdingChapterId: null, flag});
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
  if (await getSetting<boolean>(CHAPTERS_MIGRATED_KEY)) {
    summary.productions = await placeStrays();
    return summary;
  }

  const productionIds = await prisma.production.findMany({
    where: {OR: [{callSheets: {some: {items: {some: {chapterId: null}}}}}, {productionEvents: {some: {chapterId: null}}}]},
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
  await setSetting(CHAPTERS_MIGRATED_KEY, true);
  return summary;
}

/**
 * After the migration: an item or event that still has no hoofdstuk (e.g. written by an older version
 * during an upgrade) goes to its callsheet item's hoofdstuk, else the production's last one. The
 * production's hoofdstukken and its check flag are left alone. Returns the number of productions touched.
 */
async function placeStrays(): Promise<number> {
  const productions = await prisma.production.findMany({
    where: {OR: [{callSheets: {some: {items: {some: {chapterId: null}}}}}, {productionEvents: {some: {chapterId: null}}}]},
    select: {id: true, chapters: {orderBy: {orderIndex: 'desc'}, take: 1, select: {id: true}}},
  });
  let touched = 0;
  for (const production of productions) {
    const last = production.chapters[0]?.id;
    if (last == null) continue; // no hoofdstuk at all: nothing to place it in without adding one
    await prisma.$transaction(async (tx) => {
      await tx.callSheetItem.updateMany({where: {callSheet: {productionId: production.id}, chapterId: null}, data: {chapterId: last}});
      const events = await tx.productionEvent.findMany({where: {productionId: production.id, chapterId: null}, select: {id: true, callSheetItemId: true}});
      for (const event of events) {
        const item = event.callSheetItemId
          ? await tx.callSheetItem.findFirst({where: {id: event.callSheetItemId, callSheet: {productionId: production.id}}, select: {chapterId: true}})
          : null;
        await tx.productionEvent.update({where: {id: event.id}, data: {chapterId: item?.chapterId ?? last}});
      }
    });
    touched++;
  }
  return touched;
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


/** A hoofdstuk in a backup or production export: `chapters` now, `segments` (naam, volgorde, duration) in older files. */
export type FileChapter = { name: string; orderIndex: number; minDurationSec?: number | null; legacy?: { duurInMinuten: number; isTimeAnchor: boolean }; assignments: FileAssignment[] };
/** A bezetting row in a file */
export type FileAssignment = { personName: string; positionName: string; isStudio?: boolean };
type FileRow = Record<string, unknown> | null | undefined;
const assignmentsOf = (row: FileRow): FileAssignment[] => (Array.isArray(row?.assignments) ? row.assignments : []);
/** A Minimale duur from a file: whole seconds up to a day, else none */
const minimumOf = (value: unknown): number | null => (Number.isInteger(value) && Number(value) > 0 && Number(value) <= 86400 ? Number(value) : null);

/** The hoofdstukken of a file in either format; null when it has neither (the production keeps its own). */
export function fileChapters(data: { chapters?: unknown; segments?: unknown }): FileChapter[] | null {
  if (Array.isArray(data.chapters)) {
    return data.chapters.map((c: FileRow, i: number) => ({
      name: String(c?.name ?? '').trim() || DRAAIBOEK,
      orderIndex: Number.isInteger(c?.orderIndex) ? Number(c?.orderIndex) : i + 1,
      minDurationSec: minimumOf(c?.minDurationSec),
      assignments: assignmentsOf(c),
    }));
  }
  if (Array.isArray(data.segments)) {
    return data.segments.map((s: FileRow, i: number) => ({
      name: String(s?.naam ?? s?.name ?? '').trim() || DRAAIBOEK,
      orderIndex: Number.isInteger(s?.volgorde) ? Number(s?.volgorde) : i + 1,
      legacy: {duurInMinuten: Number(s?.duurInMinuten) || 0, isTimeAnchor: !!s?.isTimeAnchor},
      assignments: assignmentsOf(s),
    }));
  }
  return null;
}

/** The hoofdstuk (by its order) of an item or event in a file: `chapterOrderIndex`, or `productionSegmentVolgorde` in older files. */
export function fileChapterOrder(data: { chapterOrderIndex?: unknown; productionSegmentVolgorde?: unknown }): number | null {
  const order = Number(data.chapterOrderIndex ?? data.productionSegmentVolgorde);
  return Number.isInteger(order) && order > 0 ? order : null;
}

/**
 * Restores the hoofdstukken of one production from a file and gives every restored item one: by its
 * order, else a holding hoofdstuk *Draaiboek* from which `finish()` places the items of an older file
 * by the old segments' times (and the events without a hoofdstuk), see placeLegacyItems.
 */
export class ChapterRestore {
  private readonly byOrder = new Map<number, number>();
  private readonly legacy: LegacySegment[] = [];
  private holdingChapterId: number | null = null;

  constructor(private readonly tx: Tx, private readonly productionId: number) {}

  /** Replaces the production's hoofdstukken by those of the file; calls `withChapter` per hoofdstuk (e.g. its bezetting). */
  async restore(chapters: FileChapter[], withChapter?: (chapter: FileChapter, chapterId: number) => Promise<void>): Promise<void> {
    await this.tx.productionChapter.deleteMany({where: {productionId: this.productionId}});
    const seen = new Set<number>();
    for (const [i, chapter] of [...chapters].sort((a, b) => a.orderIndex - b.orderIndex).entries()) {
      // A duplicate order (a hand-edited file) gets a free place instead of failing the unique key
      const orderIndex = seen.has(chapter.orderIndex) ? 1000 + i : chapter.orderIndex;
      seen.add(orderIndex);
      const row = await this.tx.productionChapter.create({data: {productionId: this.productionId, name: chapter.name, orderIndex, minDurationSec: chapter.minDurationSec ?? null}});
      this.byOrder.set(chapter.orderIndex, row.id);
      if (chapter.legacy) this.legacy.push({chapterId: row.id, ...chapter.legacy});
      if (withChapter) await withChapter(chapter, row.id);
    }
  }

  /** The hoofdstuk of a restored item with this order in the file (null: none, as in older files). */
  async itemChapter(order: number | null): Promise<number> {
    if (order != null) {
      const known = this.byOrder.get(order)
        ?? (await this.tx.productionChapter.findFirst({where: {productionId: this.productionId, orderIndex: order}}))?.id;
      if (known) return known;
    }
    if (this.holdingChapterId == null) {
      const last = await this.tx.productionChapter.findFirst({where: {productionId: this.productionId}, orderBy: {orderIndex: 'desc'}});
      this.holdingChapterId = (await this.tx.productionChapter.create({
        data: {productionId: this.productionId, name: DRAAIBOEK, orderIndex: (last?.orderIndex ?? 0) + 1},
      })).id;
    }
    return this.holdingChapterId;
  }

  /** The hoofdstuk of a restored event with this order in the file, if any (events may have none). */
  eventChapter(order: number | null): number | null {
    return order == null ? null : this.byOrder.get(order) ?? null;
  }

  /** Places what an older file left without a hoofdstuk. */
  async finish(): Promise<void> {
    await placeLegacyItems(this.tx, this.productionId, {segments: this.legacy, holdingChapterId: this.holdingChapterId});
  }
}
