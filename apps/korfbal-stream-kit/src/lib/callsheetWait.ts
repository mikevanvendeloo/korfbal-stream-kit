import type {ProductionEvent} from '../hooks/useLiveState';

type TimedItem = ProductionEvent & { calculatedTime?: Date | null };

/** From this many seconds before the next item the wait row says "Maak je klaar". */
export const GET_READY_SECONDS = 30;

/** Items without positions count for everyone. */
export function isForPosition(item: ProductionEvent, positionId: number): boolean {
  return item.positions.length === 0 || item.positions.some((p) => p.position.id === positionId);
}

/** The item itself, its parent, its linked items or its siblings: they run together. */
function runsWith(item: ProductionEvent, active: ProductionEvent): boolean {
  return item.id === active.id
    || item.parentId === active.id
    || (!!active.parentId && (item.id === active.parentId || item.parentId === active.parentId));
}

export type CallsheetWait =
  /** Nothing for this position now; `secondsLeft` until the next item's (calculated) start, null without a time. */
  | { kind: 'waiting'; next: TimedItem; secondsLeft: number | null }
  /** Nothing for this position now and nothing more after it. */
  | { kind: 'done' };

/**
 * The gap in a position's callsheet: an item runs, but not one for this position (or linked to one).
 * null while nothing runs, while the position has something on now, or when it has no items at all.
 */
export function callsheetWait(items: TimedItem[], active: ProductionEvent | null, positionId: number, now: number = Date.now()): CallsheetWait | null {
  if (!active) return null;
  const mine = items.filter((item) => isForPosition(item, positionId));
  if (mine.length === 0 || mine.some((item) => runsWith(item, active))) return null;
  const next = mine
    .filter((item) => item.order > active.order)
    .sort((a, b) => a.order - b.order)[0];
  if (!next) return {kind: 'done'};
  const secondsLeft = next.calculatedTime ? Math.round((next.calculatedTime.getTime() - now) / 1000) : null;
  return {kind: 'waiting', next, secondsLeft};
}
