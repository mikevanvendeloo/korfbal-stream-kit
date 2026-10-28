import {prisma} from './prisma';
import {chapterTime, segmentWindows} from './chapters';

/**
 * Times of a production's hoofdstukken and the end of its livestream (openspec/changes/chapters D1):
 * derived from the items' calculated times (`CallSheetItem.timeStart/timeEnd`). A production whose
 * items have no times yet keeps the old segment durations, so it shows what it showed before.
 */

export type ChapterTiming = {
  id: number;
  naam: string;
  volgorde: number;
  /** Derived from the items (or the segment's duration without timed items) */
  duurInMinuten: number;
  isTimeAnchor: boolean;
  start: string;
  end: string;
};

type ChapterRow = { id: number; naam: string; volgorde: number; duurInMinuten: number; isTimeAnchor: boolean };
type ItemTimes = { productionSegmentId: number | null; timeStart: Date | null; timeEnd: Date | null };

/** The hoofdstukken of one production with their start and end, in order. */
export function chapterTimings(chapters: ChapterRow[], items: ItemTimes[], matchDate: Date): ChapterTiming[] {
  const ordered = [...chapters].sort((a, b) => a.volgorde - b.volgorde);
  const timed = items.filter((i) => i.timeStart != null && i.productionSegmentId != null);
  if (timed.length === 0) {
    const windows = segmentWindows(ordered.map((c) => ({key: c.id, duurInMinuten: c.duurInMinuten, isTimeAnchor: c.isTimeAnchor})), matchDate.getTime());
    return ordered.map((c, i) => ({...c, start: new Date(windows[i].start).toISOString(), end: new Date(windows[i].end).toISOString()}));
  }
  let previousEnd = Math.min(...timed.map((i) => i.timeStart?.getTime() ?? Infinity));
  return ordered.map((c) => {
    const time = chapterTime(timed.filter((i) => i.productionSegmentId === c.id));
    // A hoofdstuk without timed items sits where the previous one ended, with no length
    const start = time.start?.getTime() ?? previousEnd;
    const end = time.end?.getTime() ?? start;
    previousEnd = end;
    return {...c, duurInMinuten: time.durationMinutes, start: new Date(start).toISOString(), end: new Date(end).toISOString()};
  });
}

/** GET /api/production/:id/timing: the hoofdstukken with their derived times; [] without hoofdstukken. */
export async function productionChapterTimings(productionId: number, matchDate: Date): Promise<ChapterTiming[]> {
  const [chapters, items] = await Promise.all([
    prisma.productionChapter.findMany({where: {productionId}, orderBy: {volgorde: 'asc'}}),
    prisma.callSheetItem.findMany({where: {callSheet: {productionId}}, select: {productionSegmentId: true, timeStart: true, timeEnd: true}}),
  ]);
  return chapterTimings(chapters, items, matchDate);
}

/**
 * The end of the livestream per production: the latest planned end of its items, or, without timed
 * items, the live start plus the segment durations (as before). Null without a live start and items.
 */
export async function liveEnds(productions: Array<{ id: number; liveTime: Date | null; segments: Array<{ duurInMinuten: number }> }>): Promise<Map<number, Date | null>> {
  const ids = productions.map((p) => p.id);
  const items = ids.length
    ? await prisma.callSheetItem.findMany({
      where: {callSheet: {productionId: {in: ids}}, timeEnd: {not: null}},
      select: {timeEnd: true, callSheet: {select: {productionId: true}}},
    })
    : [];
  const latest = new Map<number, number>();
  for (const item of items) {
    const id = item.callSheet.productionId;
    if (item.timeEnd) latest.set(id, Math.max(latest.get(id) ?? -Infinity, item.timeEnd.getTime()));
  }
  return new Map(productions.map((p) => {
    const end = latest.get(p.id);
    if (end != null) return [p.id, new Date(end)];
    if (!p.liveTime) return [p.id, null];
    const minutes = p.segments.reduce((sum, s) => sum + s.duurInMinuten, 0);
    return [p.id, new Date(p.liveTime.getTime() + minutes * 60_000)];
  }));
}

/** The hoofdstukken of a production as LIVE shows them: headings in show order (each event has a chapterId). */
export async function liveChapters(productionId: number): Promise<Array<{ id: number; name: string; order: number }>> {
  const chapters = await prisma.productionChapter.findMany({where: {productionId}, orderBy: {volgorde: 'asc'}, select: {id: true, naam: true, volgorde: true}});
  return chapters.map((c) => ({id: c.id, name: c.naam, order: c.volgorde}));
}
