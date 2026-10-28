/**
 * Hoofdstukken (chapters) of a draaiboek: pure timing and placement helpers (openspec/changes/chapters).
 * A hoofdstuk has no duration of its own; its start and end follow from its items (D1). Times are
 * milliseconds; a template has no date, so its times are relative to the match start (0).
 */

export type AnchorType = 'MATCH_START' | 'LIVESTREAM_START' | string | null;

export type TimedItem = {
  id: string;
  durationSec: number | null;
  isTimeAnchor: boolean;
  anchorType: AnchorType;
  parentId?: string | null;
};

/** A time window with the key of its hoofdstuk (or segment). */
export type ChapterWindow<K> = { key: K; start: number; end: number };

/** Where an item went: a window's key, or before the first window (a new Voorbereiding hoofdstuk). */
export type Placement<K> = K | 'BEFORE';

const MINUTE = 60_000;

/**
 * The windows of segments with a duration, anchored like the production timing (production-timing.ts):
 * the anchor segment (else the first) starts at `kickoff`, the others follow and precede it.
 */
export function segmentWindows<K>(
  segments: Array<{ key: K; duurInMinuten: number; isTimeAnchor: boolean }>,
  kickoff: number,
): ChapterWindow<K>[] {
  if (segments.length === 0) return [];
  const anchorIndex = Math.max(0, segments.findIndex((s) => s.isTimeAnchor));
  const windows = segments.map((s) => ({key: s.key, start: 0, end: 0}));
  let t = kickoff;
  for (let i = anchorIndex; i < segments.length; i++) {
    windows[i].start = t;
    t += segments[i].duurInMinuten * MINUTE;
    windows[i].end = t;
  }
  t = kickoff;
  for (let i = anchorIndex - 1; i >= 0; i--) {
    windows[i].end = t;
    t -= segments[i].duurInMinuten * MINUTE;
    windows[i].start = t;
  }
  return windows;
}

/**
 * Start times of items in show order, laid end to end from one anchor item (as the callsheet calculation
 * does). For placing items in hoofdstukken the match start anchor is preferred over the livestream
 * start: the segments are anchored at the kickoff too, and the first anchor of a draaiboek is often
 * *Livestream starten*, from which the pre-show items would end up after the kickoff.
 */
export function sequentialStarts(items: TimedItem[], anchorTimes: { MATCH_START: number; LIVESTREAM_START: number }): Map<string, number> {
  const starts = new Map<string, number>();
  if (items.length === 0) return starts;
  let anchorIndex = items.findIndex((it) => it.isTimeAnchor && it.anchorType === 'MATCH_START');
  if (anchorIndex === -1) anchorIndex = items.findIndex((it) => it.isTimeAnchor);
  const anchor = anchorIndex === -1 ? undefined : items[anchorIndex];
  const anchorTime = anchor?.anchorType === 'LIVESTREAM_START' ? anchorTimes.LIVESTREAM_START : anchorTimes.MATCH_START;
  const from = Math.max(0, anchorIndex);
  let t = anchorTime;
  for (let i = from; i < items.length; i++) {
    starts.set(items[i].id, t);
    t += (items[i].durationSec ?? 0) * 1000;
  }
  t = anchorTime;
  for (let i = from - 1; i >= 0; i--) {
    t -= (items[i].durationSec ?? 0) * 1000;
    starts.set(items[i].id, t);
  }
  return starts;
}

/**
 * The hoofdstuk of every item (D7): the window that contains its start ([start, end)). Before the first
 * window: 'BEFORE' (a Voorbereiding hoofdstuk); after the last: the last window. Linked items follow
 * their parent; an item without a time takes the hoofdstuk of the item before it (or the first window).
 * Items are given in show order.
 */
export function placeItemsInChapters<K>(
  windows: ChapterWindow<K>[],
  items: Array<{ id: string; start: number | null; parentId?: string | null }>,
): Map<string, Placement<K>> {
  const placement = new Map<string, Placement<K>>();
  if (windows.length === 0) return placement;
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  let previous: Placement<K> = sorted[0].key;
  for (const item of items) {
    let place: Placement<K>;
    const parentPlace = item.parentId ? placement.get(item.parentId) : undefined;
    if (parentPlace !== undefined) {
      place = parentPlace;
    } else if (item.start == null) {
      place = previous;
    } else if (item.start < sorted[0].start) {
      place = 'BEFORE';
    } else {
      const start = item.start;
      place = (sorted.find((w) => start >= w.start && start < w.end) ?? sorted[sorted.length - 1]).key;
    }
    placement.set(item.id, place);
    previous = place;
  }
  return placement;
}

export type ChapterTime = { start: Date | null; end: Date | null; durationMinutes: number };

/** A hoofdstuk's start, end and duration from its items' calculated times (D1); null without timed items. */
export function chapterTime(items: Array<{ timeStart: Date | null; timeEnd: Date | null }>): ChapterTime {
  const starts = items.map((i) => i.timeStart?.getTime()).filter((t): t is number => t != null);
  const ends = items.map((i) => (i.timeEnd ?? i.timeStart)?.getTime()).filter((t): t is number => t != null);
  if (starts.length === 0) return {start: null, end: null, durationMinutes: 0};
  const start = Math.min(...starts);
  const end = Math.max(...ends, start);
  return {start: new Date(start), end: new Date(end), durationMinutes: Math.round((end - start) / MINUTE)};
}
