import {prisma} from './prisma';
import {chapterSpan} from './laneTimes';

/**
 * Times of a production's hoofdstukken and the end of its livestream (openspec/changes/chapters D1):
 * derived from the items' calculated times (`CallSheetItem.timeStart/timeEnd`) and a hoofdstuk's minimum
 * (parallel-lanes D2): it lasts at least its Minimale duur.
 */

export type ChapterTiming = {
  id: number;
  name: string;
  orderIndex: number;
  /** From the start to the end; 0 without timed items */
  durationMinutes: number;
  /** Minimale duur in seconds; null = as long as its items */
  minDurationSec: number | null;
  /** How much longer the items run than the minimum, in seconds (0 without minimum) */
  overrunSec: number;
  /** Null when no item of the draaiboek has a time yet */
  start: string | null;
  end: string | null;
};

type ChapterRow = { id: number; name: string; orderIndex: number; minDurationSec?: number | null };
type ItemTimes = { chapterId: number | null; timeStart: Date | null; timeEnd: Date | null };

/** The hoofdstukken of one production with their start and end, in order. */
export function chapterTimings(chapters: ChapterRow[], items: ItemTimes[]): ChapterTiming[] {
  const ordered = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const timed = items.filter((i) => i.timeStart != null);
  let previousEnd: number | null = timed.length ? Math.min(...timed.map((i) => i.timeStart?.getTime() ?? Infinity)) : null;
  return ordered.map((chapter) => {
    const {id, name, orderIndex} = chapter;
    // The end is max(items end, start + minimum) (parallel-lanes D2)
    const span = chapterSpan(chapter, timed.filter((i) => i.chapterId === id).map((i) => ({start: i.timeStart?.getTime() ?? null, end: (i.timeEnd ?? i.timeStart)?.getTime() ?? null})));
    // A hoofdstuk without timed items sits where the previous one ended, with no length
    const start = span.start ?? previousEnd;
    const end = span.end ?? start;
    previousEnd = end;
    const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString());
    const durationMinutes = span.start != null && end != null ? Math.round((end - span.start) / 60_000) : 0;
    return {id, name, orderIndex, durationMinutes, minDurationSec: span.minDurationSec, overrunSec: span.overrunSec, start: iso(start), end: iso(end)};
  });
}

/** GET /api/production/:id/timing: the hoofdstukken with their derived times; [] without hoofdstukken. */
export async function productionChapterTimings(productionId: number): Promise<ChapterTiming[]> {
  const [chapters, items] = await Promise.all([
    prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}, select: {id: true, name: true, orderIndex: true, minDurationSec: true}}),
    prisma.callSheetItem.findMany({where: {callSheet: {productionId}}, select: {chapterId: true, timeStart: true, timeEnd: true}}),
  ]);
  return chapterTimings(chapters, items);
}

/**
 * The end of the livestream per production: the latest planned end of its items, or of a hoofdstuk that lasts
 * longer by its Minimale duur (parallel-lanes D2); null without timed items.
 */
export async function liveEnds(productionIds: number[]): Promise<Map<number, Date | null>> {
  const [items, minimums] = productionIds.length
    ? await Promise.all([
      prisma.callSheetItem.findMany({
        where: {callSheet: {productionId: {in: productionIds}}, timeStart: {not: null}},
        select: {chapterId: true, timeStart: true, timeEnd: true, callSheet: {select: {productionId: true}}},
      }),
      prisma.productionChapter.findMany({where: {productionId: {in: productionIds}, minDurationSec: {not: null}}, select: {id: true, minDurationSec: true}}),
    ])
    : [[], []];
  const minimumOf = new Map(minimums.map((c) => [c.id, c.minDurationSec ?? 0]));
  const latest = new Map<number, number>();
  const chapterStart = new Map<number, { productionId: number; start: number }>();
  for (const item of items) {
    const id = item.callSheet.productionId;
    if (item.timeEnd) latest.set(id, Math.max(latest.get(id) ?? -Infinity, item.timeEnd.getTime()));
    if (item.chapterId != null && item.timeStart && minimumOf.has(item.chapterId)) {
      const known = chapterStart.get(item.chapterId);
      if (!known || item.timeStart.getTime() < known.start) chapterStart.set(item.chapterId, {productionId: id, start: item.timeStart.getTime()});
    }
  }
  for (const [chapterId, {productionId, start}] of chapterStart) {
    latest.set(productionId, Math.max(latest.get(productionId) ?? -Infinity, start + (minimumOf.get(chapterId) ?? 0) * 1000));
  }
  return new Map(productionIds.map((id) => {
    const end = latest.get(id);
    return [id, end == null ? null : new Date(end)];
  }));
}

/** The hoofdstukken of a production as LIVE shows them: headings in show order (each event has a chapterId). */
export async function liveChapters(productionId: number): Promise<Array<{ id: number; name: string; order: number; minDurationSec: number | null }>> {
  const chapters = await prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}, select: {id: true, name: true, orderIndex: true, minDurationSec: true}});
  return chapters.map((c) => ({id: c.id, name: c.name, order: c.orderIndex, minDurationSec: c.minDurationSec}));
}
