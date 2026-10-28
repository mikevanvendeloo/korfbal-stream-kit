import type {LiveChapter, ProductionEvent} from '../hooks/useLiveState';

/**
 * Hoofdstukken in LIVE (openspec/changes/chapters D5): headings, not steps. Show control still goes per
 * item; these helpers only say which hoofdstuk an item is in and how long the current one still takes.
 */

type TimedEvent = ProductionEvent & { calculatedTime?: Date | null };

export function chapterName(chapters: LiveChapter[], chapterId: number | null | undefined): string | null {
  return chapters.find((c) => c.id === chapterId)?.name ?? null;
}

/**
 * The hoofdstuk of the active item and how long it still takes: the rest of the active item plus the
 * durations of the items after it in the same hoofdstuk (linked items run alongside and don't add up).
 */
export function currentChapter(
  events: ProductionEvent[], activeEventId: string | null, remainingSec: number | null, chapters: LiveChapter[],
): { name: string; remainingSec: number } | null {
  const active = events.find((e) => e.id === activeEventId);
  const name = chapterName(chapters, active?.chapterId);
  if (!active || !name) return null;
  const later = events
    .filter((e) => e.chapterId === active.chapterId && !e.parentId && e.order > active.order && e.status !== 'COMPLETED')
    .reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
  return {name, remainingSec: Math.max(0, remainingSec ?? active.durationSec ?? 0) + later};
}

type ChapterTime = { start: Date | null; end: Date | null };

/** The planned start and end of every hoofdstuk, from its items' expected times. */
export function chapterTimes(events: TimedEvent[], chapters: LiveChapter[]): Map<number, ChapterTime> {
  return new Map(chapters.map((c): [number, ChapterTime] => {
    const own = events.filter((e) => e.chapterId === c.id && e.calculatedTime);
    if (own.length === 0) return [c.id, {start: null, end: null}];
    const starts = own.map((e) => (e.calculatedTime as Date).getTime());
    const ends = own.map((e) => (e.calculatedTime as Date).getTime() + (e.durationSec ?? 0) * 1000);
    return [c.id, {start: new Date(Math.min(...starts)), end: new Date(Math.max(...ends))}];
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
