import type {ProductionEvent} from '../hooks/useLiveState';
import {isForPosition} from './callsheetWait';

type TimedItem = ProductionEvent & {calculatedTime?: Date | null};

/** A column's slot key: "<time>#<index among that column's items at that time>" (as CallSheetView builds them) */
const timeKey = (item: TimedItem) => (item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time');

/**
 * The time slots a callsheet shows in full: per shown position the item that runs now (stream and hall) and
 * its next item still to come. Every other slot is one compact line (time, title, duration). Decided per slot,
 * not per item, so placeholders in the other columns get the same height and the columns stay aligned.
 */
export function callsheetFullSlots(items: TimedItem[], positionIds: number[], activeIds: ReadonlySet<string>): Set<string> {
  const full = new Set<string>();
  for (const positionId of positionIds) {
    const relevant = items.filter((item) => isForPosition(item, positionId));
    const next = relevant.find((item) => item.status === 'WAITING' && !activeIds.has(item.id));
    const counts: Record<string, number> = {};
    for (const item of relevant) {
      const t = timeKey(item);
      const n = counts[t] ?? 0;
      counts[t] = n + 1;
      if (activeIds.has(item.id) || item.id === next?.id) full.add(`${t}#${n}`);
    }
  }
  return full;
}
