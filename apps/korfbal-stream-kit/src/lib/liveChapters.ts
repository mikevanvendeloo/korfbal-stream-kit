import type {LiveChapter, ProductionEvent} from '../hooks/useLiveState';
import {blockIndexes, hallLaneItems, laneOf} from './lanes';

/**
 * Hoofdstukken in LIVE (openspec/changes/chapters D5): headings, not steps. Show control still goes per
 * item; these helpers only say which hoofdstuk an item is in and how long the current one still takes.
 */

type TimedEvent = ProductionEvent & { calculatedTime?: Date | null };

export function chapterName(chapters: LiveChapter[], chapterId: number | null | undefined): string | null {
  return chapters.find((c) => c.id === chapterId)?.name ?? null;
}

/** The hall item running next to the stream, with its remaining seconds (openspec/changes/parallel-lanes D4) */
export type RunningVenue = { id: string; remainingSec: number | null } | null;

/**
 * The hoofdstuk of the active item and how long it still takes (linked items run alongside and don't add
 * up). Zaal and Stream are parallel lanes: the current block lasts as long as its longer lane (the rest of
 * the active item and the hall item, plus what still waits in each lane), every later block as long as its
 * longer lane. A hoofdstuk with a Minimale duur ends no earlier than its start + that minimum.
 */
export function currentChapter(
  events: ProductionEvent[], activeEventId: string | null, remainingSec: number | null, chapters: LiveChapter[],
  venue: RunningVenue = null, now: number = Date.now(),
): { name: string; remainingSec: number } | null {
  const active = events.find((e) => e.id === activeEventId);
  const chapter = chapters.find((c) => c.id === active?.chapterId);
  if (!active || !chapter) return null;
  const ordered = [...events].sort((a, b) => a.order - b.order);
  const lanes = ordered.map(laneOf);
  const blocks = blockIndexes(ordered);
  const inHall = hallLaneItems(ordered);
  const blockOf = (id: string) => blocks[ordered.findIndex((e) => e.id === id)];
  const activeBlock = blockOf(active.id);
  const duration = (e: ProductionEvent) => e.durationSec ?? 0;
  const ownWaiting = (e: ProductionEvent) => e.chapterId === active.chapterId && !e.parentId && e.status !== 'COMPLETED' && e.id !== active.id && e.id !== venue?.id;

  // The current block: each lane's rest
  let stream = Math.max(0, remainingSec ?? active.durationSec ?? 0);
  let hall = venue && blockOf(venue.id) === activeBlock ? Math.max(0, venue.remainingSec ?? 0) : 0;
  // Later blocks: per block the length of each lane
  const later = new Map<number, { zaal: number; stream: number }>();
  ordered.forEach((e, i) => {
    if (!ownWaiting(e)) return;
    if (blocks[i] === activeBlock) {
      if (inHall[i]) hall += duration(e);
      else if (e.order > active.order) stream += duration(e);
      return;
    }
    if (e.order < active.order) return;
    const lengths = later.get(blocks[i]) ?? {zaal: 0, stream: 0};
    if (lanes[i] === 'ZAAL') lengths.zaal += duration(e);
    else lengths.stream += duration(e);
    later.set(blocks[i], lengths);
  });
  let rest = Math.max(stream, hall) + [...later.values()].reduce((sum, l) => sum + Math.max(l.zaal, l.stream), 0);

  // The Minimale duur counts from the hoofdstuk's actual start
  if (chapter.minDurationSec) {
    const starts = events
      .filter((e) => e.chapterId === chapter.id && e.actualStartTime)
      .map((e) => new Date(e.actualStartTime as Date | string).getTime());
    if (starts.length > 0) rest = Math.max(rest, (Math.min(...starts) + chapter.minDurationSec * 1000 - now) / 1000);
  }
  return {name: chapter.name, remainingSec: Math.max(0, Math.round(rest))};
}

type ChapterTime = { start: Date | null; end: Date | null };

/** The planned start and end of every hoofdstuk, from its items' expected times. */
export function chapterTimes(events: TimedEvent[], chapters: LiveChapter[]): Map<number, ChapterTime> {
  return new Map(chapters.map((c): [number, ChapterTime] => {
    const own = events.filter((e) => e.chapterId === c.id && e.calculatedTime);
    if (own.length === 0) return [c.id, {start: null, end: null}];
    const starts = own.map((e) => (e.calculatedTime as Date).getTime());
    const ends = own.map((e) => (e.calculatedTime as Date).getTime() + (e.durationSec ?? 0) * 1000);
    const start = Math.min(...starts);
    // A hoofdstuk lasts at least its Minimale duur
    return [c.id, {start: new Date(start), end: new Date(Math.max(...ends, start + (c.minDurationSec ?? 0) * 1000))}];
  }));
}

/** "12:30": seconds as minutes and seconds. */
export function minutesSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The callsheet's time slots ("<iso>#<n>") grouped per hoofdstuk, each group headed by "chapter:<id>"
 * (also for a hoofdstuk without slots, so a column can say "niets voor jou"). A slot belongs to the
 * hoofdstuk of an item at that time; slots without one come last, without a heading.
 */
export function withChapterHeadings(
  slots: string[], items: Array<{ chapterId?: number | null; calculatedTime?: Date | null }>, chapters: LiveChapter[],
): string[] {
  if (chapters.length === 0) return slots;
  const chapterOfTime = new Map<string, number | null>();
  for (const item of items) {
    const time = item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time';
    if (!chapterOfTime.has(time)) chapterOfTime.set(time, item.chapterId ?? null);
  }
  const chapterOf = (slot: string) => chapterOfTime.get(slot.split('#')[0]) ?? null;
  const known = new Set(chapters.map((c) => c.id));
  return [
    ...[...chapters].sort((a, b) => a.order - b.order).flatMap((c) => [`chapter:${c.id}`, ...slots.filter((s) => chapterOf(s) === c.id)]),
    ...slots.filter((s) => !known.has(chapterOf(s) ?? -1)),
  ];
}
