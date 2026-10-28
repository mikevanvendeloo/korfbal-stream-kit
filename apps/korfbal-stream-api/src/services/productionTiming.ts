import {prisma} from './prisma';
import {chapterTime} from './chapters';

/**
 * Times of a production's hoofdstukken and the end of its livestream (openspec/changes/chapters D1):
 * derived from the items' calculated times (`CallSheetItem.timeStart/timeEnd`). A hoofdstuk has no
 * duration of its own.
 */

export type ChapterTiming = {
  id: number;
  name: string;
  orderIndex: number;
  /** From the first item's start to the latest item's end; 0 without timed items */
  durationMinutes: number;
  /** Null when no item of the draaiboek has a time yet */
  start: string | null;
  end: string | null;
};

type ChapterRow = { id: number; name: string; orderIndex: number };
type ItemTimes = { chapterId: number; timeStart: Date | null; timeEnd: Date | null };

/** The hoofdstukken of one production with their start and end, in order. */
export function chapterTimings(chapters: ChapterRow[], items: ItemTimes[]): ChapterTiming[] {
  const ordered = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const timed = items.filter((i) => i.timeStart != null);
  let previousEnd: number | null = timed.length ? Math.min(...timed.map((i) => i.timeStart?.getTime() ?? Infinity)) : null;
  return ordered.map(({id, name, orderIndex}) => {
    const time = chapterTime(timed.filter((i) => i.chapterId === id));
    // A hoofdstuk without timed items sits where the previous one ended, with no length
    const start = time.start?.getTime() ?? previousEnd;
    const end = time.end?.getTime() ?? start;
    previousEnd = end;
    const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString());
    return {id, name, orderIndex, durationMinutes: time.durationMinutes, start: iso(start), end: iso(end)};
  });
}

/** GET /api/production/:id/timing: the hoofdstukken with their derived times; [] without hoofdstukken. */
export async function productionChapterTimings(productionId: number): Promise<ChapterTiming[]> {
  const [chapters, items] = await Promise.all([
    prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}, select: {id: true, name: true, orderIndex: true}}),
    prisma.callSheetItem.findMany({where: {callSheet: {productionId}}, select: {chapterId: true, timeStart: true, timeEnd: true}}),
  ]);
  return chapterTimings(chapters, items);
}

/** The end of the livestream per production: the latest planned end of its items; null without timed items. */
export async function liveEnds(productionIds: number[]): Promise<Map<number, Date | null>> {
  const items = productionIds.length
    ? await prisma.callSheetItem.findMany({
      where: {callSheet: {productionId: {in: productionIds}}, timeEnd: {not: null}},
      select: {timeEnd: true, callSheet: {select: {productionId: true}}},
    })
    : [];
  const latest = new Map<number, number>();
  for (const item of items) {
    const id = item.callSheet.productionId;
    if (item.timeEnd) latest.set(id, Math.max(latest.get(id) ?? -Infinity, item.timeEnd.getTime()));
  }
  return new Map(productionIds.map((id) => {
    const end = latest.get(id);
    return [id, end == null ? null : new Date(end)];
  }));
}

/** The hoofdstukken of a production as LIVE shows them: headings in show order (each event has a chapterId). */
export async function liveChapters(productionId: number): Promise<Array<{ id: number; name: string; order: number }>> {
  const chapters = await prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}, select: {id: true, name: true, orderIndex: true}});
  return chapters.map((c) => ({id: c.id, name: c.name, order: c.orderIndex}));
}
