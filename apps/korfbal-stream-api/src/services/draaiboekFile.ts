import type {DraaiboekFile} from '../schemas/draaiboekFile';
import {DRAAIBOEK} from './chapterMigration';
import {chapterMinimums, chapterSpan, ItemTimes, LaneItem, LaneOptions, layOutLaneTimes} from './laneTimes';

/**
 * Importing a draaiboek file into a production's callsheet (pure part): which hoofdstuk each item goes
 * to, the flat show order and the planned times. Hoofdstukken are matched by name ignoring case and
 * spacing; missing ones are added after the production's own, in the order the file names them.
 */

/** "Eerste  Helft" = "eerste helft" */
export const chapterKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export type PlannedItem = {
  /** Index in the file's items */
  index: number;
  chapterName: string;
  /** Index of the parent item in the file, when it links to one */
  parentIndex: number | null;
  orderIndex: number;
};

export type ImportPlan = {
  /** Hoofdstukken to add to the production, in order */
  newChapters: string[];
  /** In show order: the production's hoofdstuk order, then the file's order within a hoofdstuk */
  items: PlannedItem[];
};

export function planDraaiboekImport(file: DraaiboekFile, existingChapters: string[]): ImportPlan {
  const known = new Map(existingChapters.map((name) => [chapterKey(name), name]));
  const newChapters: string[] = [];
  const resolve = (name: string): string => {
    const key = chapterKey(name);
    const found = known.get(key);
    if (found) return found;
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 100);
    known.set(key, trimmed);
    newChapters.push(trimmed);
    return trimmed;
  };
  for (const chapter of file.chapters ?? []) if (chapter.name.trim()) resolve(chapter.name);

  // In the file's own order (orderIndex, else its place in the list)
  const order = file.items.map((item, index) => ({item, index}))
    .sort((a, b) => (a.item.orderIndex ?? a.index) - (b.item.orderIndex ?? b.index) || a.index - b.index);
  const indexById = new Map(file.items.map((item, index) => [item.id, index] as const).filter(([id]) => id != null));

  const chapterOf = new Map<number, string>();
  const parentOf = new Map<number, number | null>();
  let previous: string | undefined;
  for (const {item, index} of order) {
    const parentIndex = item.parentId != null ? indexById.get(item.parentId) ?? null : null;
    parentOf.set(index, parentIndex !== index ? parentIndex : null);
    const parentChapter = parentIndex != null ? chapterOf.get(parentIndex) : undefined;
    // A linked item stays with its parent; an item without a hoofdstuk takes the one before it
    const chapter = parentChapter
      ?? (item.chapter?.trim() ? resolve(item.chapter) : undefined)
      ?? previous
      ?? resolve(existingChapters[0] ?? newChapters[0] ?? DRAAIBOEK);
    chapterOf.set(index, chapter);
    previous = chapter;
  }

  const chapterOrder = [...existingChapters, ...newChapters].map(chapterKey);
  const items = order
    .map(({index}) => ({index, chapterName: chapterOf.get(index) as string, parentIndex: parentOf.get(index) ?? null}))
    .sort((a, b) => chapterOrder.indexOf(chapterKey(a.chapterName)) - chapterOrder.indexOf(chapterKey(b.chapterName)))
    .map((item, i) => ({...item, orderIndex: i + 1}));
  return {newChapters, items};
}

/**
 * Planned start and end of items in show order ("Tijden herberekenen", applying a template and the import):
 * Zaal and Stream as parallel lanes, every anchor at its own time and a minimum per hoofdstuk
 * (services/laneTimes.ts). Without lanes or minimums the items follow each other end to end.
 */
export function layOutTimes(items: LaneItem[], options: LaneOptions): ItemTimes[] {
  return layOutLaneTimes(items, options);
}

export {chapterMinimums} from './laneTimes';

const TEMPLATE_KICKOFF = new Date(0);
const TEMPLATE_LIVE_START = new Date(-30 * 60 * 1000);

/**
 * The times of a draaiboek template relative to the match start, in seconds (parallel-lanes D2): every
 * item's `startOffsetSec` (null without an anchor) and every hoofdstuk's start, end and overrun. Items go in
 * show order: the hoofdstukken' order, then the items' own order. The livestream start sits 30 minutes
 * before the kickoff, as for a production without a live time.
 */
export function templateTimes<C extends { id: string; orderIndex: number; minDurationSec: number | null }, I extends LaneItem & { id: string; orderIndex: number; chapterId: string | null }>(
  chapters: C[], items: I[],
) {
  const chapterOrder = new Map(chapters.map((c) => [c.id, c.orderIndex]));
  const ordered = [...items].sort((a, b) =>
    (chapterOrder.get(a.chapterId ?? '') ?? Infinity) - (chapterOrder.get(b.chapterId ?? '') ?? Infinity) || a.orderIndex - b.orderIndex);
  const laid = layOutLaneTimes(ordered, {kickoff: TEMPLATE_KICKOFF, liveStart: TEMPLATE_LIVE_START, chapterMinimums: chapterMinimums(chapters)});
  const span = new Map(ordered.map((item, i) => [item.id, {start: laid[i].timeStart?.getTime() ?? null, end: laid[i].timeEnd?.getTime() ?? null}]));
  const seconds = (ms: number | null) => (ms == null ? null : Math.round(ms / 1000));
  return {
    items: items.map((item) => ({...item, startOffsetSec: seconds(span.get(item.id)?.start ?? null)})),
    chapters: chapters.map((chapter) => {
      const s = chapterSpan(chapter, items.filter((i) => i.chapterId === chapter.id).map((i) => span.get(i.id) ?? {start: null, end: null}));
      return {...chapter, startOffsetSec: seconds(s.start), endOffsetSec: seconds(s.end), overrunSec: s.overrunSec};
    }),
  };
}
