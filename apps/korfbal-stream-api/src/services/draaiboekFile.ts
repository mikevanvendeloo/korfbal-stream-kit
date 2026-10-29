import type {DraaiboekFile} from '../schemas/draaiboekFile';
import {DRAAIBOEK} from './chapterMigration';

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
 * Planned start and end of items in show order, as "Tijden berekenen" does: from the first anchor
 * (match start, or the livestream start), backwards and forwards by duration. Without an anchor an item
 * keeps its offset from the kickoff when the file gives one.
 */
export function layOutTimes(
  items: Array<{ durationSec: number; isTimeAnchor: boolean; anchorType: string | null; startOffsetSec: number | null }>,
  {kickoff, liveStart}: { kickoff: Date; liveStart: Date },
): Array<{ timeStart: Date | null; timeEnd: Date | null }> {
  const anchorIndex = items.findIndex((it) => it.isTimeAnchor);
  if (anchorIndex === -1) {
    return items.map((it) => {
      if (it.startOffsetSec == null) return {timeStart: null, timeEnd: null};
      const start = kickoff.getTime() + it.startOffsetSec * 1000;
      return {timeStart: new Date(start), timeEnd: new Date(start + it.durationSec * 1000)};
    });
  }
  const anchorTime = items[anchorIndex].anchorType === 'LIVESTREAM_START' ? liveStart : kickoff;
  const times: Array<{ timeStart: Date | null; timeEnd: Date | null }> = items.map(() => ({timeStart: null, timeEnd: null}));
  let t = anchorTime.getTime();
  for (let i = anchorIndex; i < items.length; i++) {
    times[i] = {timeStart: new Date(t), timeEnd: new Date(t + items[i].durationSec * 1000)};
    t += items[i].durationSec * 1000;
  }
  t = anchorTime.getTime();
  for (let i = anchorIndex - 1; i >= 0; i--) {
    times[i] = {timeStart: new Date(t - items[i].durationSec * 1000), timeEnd: new Date(t)};
    t -= items[i].durationSec * 1000;
  }
  return times;
}
