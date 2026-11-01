import {Fragment, ReactNode} from 'react';
import {CallSheetItem} from './CallSheetItem';
import {CallSheetWaitRow} from './CallSheetWaitRow';
import {LiveChapter, Position, ProductionEvent} from '../hooks/useLiveState';
import {chapterName} from '../lib/liveChapters';
import {callsheetWait, isForPosition} from '../lib/callsheetWait';

/** Set by CallSheetView from the measured height of its sticky page header */
export const CALLSHEET_HEADER_VAR = '--callsheet-header-h';
// Tailwind needs the literal class: keep the variable name in sync with CALLSHEET_HEADER_VAR
const STICKY_UNDER_PAGE_HEADER = 'sticky top-[var(--callsheet-header-h,0px)]';

interface Props {
  title: string;
  positionId: number;
  items: (ProductionEvent & { calculatedTime?: Date | null })[];
  activeEvent: ProductionEvent | null;
  autoAdvanceEventId: string | null;
  elapsedTime: number;
  allTimes: string[];
  allPositions: Position[];
  onPositionChange: (id: number) => void;
  secondaryPositionId: number | null;
  tertiaryPositionId?: number | null;
  accentColor: 'blue' | 'emerald' | 'purple';
  activeEventRemainingTime?: { minutes: string; seconds: string; isNegative: boolean; rawSeconds: number } | null;
  isCompact?: boolean;
  /** The hall item running next to the stream, with its countdown (openspec/changes/parallel-lanes D4) */
  activeVenueEvent?: ProductionEvent | null;
  activeVenueRemainingTime?: { minutes: string; seconds: string; isNegative: boolean; rawSeconds: number } | null;
  /** The hoofdstukken: `allTimes` holds a heading slot "chapter:<id>" before each one */
  chapters?: LiveChapter[];
  /** Slots shown in full (current and next item, see callsheetFullSlots); the others are one compact line. Absent: all full */
  fullSlots?: ReadonlySet<string>;
}

export const CallSheetColumn = ({
  title,
  positionId,
  items,
  activeEvent,
  autoAdvanceEventId,
  elapsedTime,
  allTimes,
  allPositions,
  onPositionChange,
  secondaryPositionId,
  tertiaryPositionId,
  accentColor,
  activeEventRemainingTime = null,
  isCompact = false,
  chapters = [],
  activeVenueEvent = null,
  activeVenueRemainingTime = null,
  fullSlots,
}: Props) => {
  const isBlue = accentColor === 'blue';
  const isEmerald = accentColor === 'emerald';

  // Filter de items die relevant zijn voor de positie van deze kolom.
  const relevantItems = items.filter(item => isForPosition(item, positionId));

  // The show runs something that isn't for this position: a wait row where the active item would be (its
  // placeholder slot when other columns show it), else right before the position's next item, else at the end.
  const wait = callsheetWait(items, activeEvent, positionId, Date.now(), activeVenueEvent);
  const isActive = (id: string) => activeEvent?.id === id || activeVenueEvent?.id === id;
  const remainingOf = (id: string) => activeEvent?.id === id ? activeEventRemainingTime : activeVenueEvent?.id === id ? activeVenueRemainingTime : null;
  const activeTime = wait && items.find(item => item.id === activeEvent?.id)?.calculatedTime?.toISOString();
  let waitPlaced = false;
  const waitRow = (): ReactNode => {
    if (!wait || waitPlaced) return null;
    waitPlaced = true;
    return <CallSheetWaitRow wait={wait} chapterName={wait.kind === 'waiting' ? chapterName(chapters, wait.next.chapterId) : null}/>;
  };

  const isCompactSlot = (slot: string) => !!fullSlots && !fullSlots.has(slot);

  const itemsByTime: Record<string, (ProductionEvent & { calculatedTime?: Date | null })[]> = {};
  relevantItems.forEach(item => {
    const timeKey = item.calculatedTime ? item.calculatedTime.toISOString() : 'no-time';
    if (!itemsByTime[timeKey]) {
      itemsByTime[timeKey] = [];
    }
    itemsByTime[timeKey].push(item);
  });

  return (
    <div className={`bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5 shadow-xl transition-all`}>
      {/* Kolom Header met Positie Selectie */}
      {/* The column headers stick right under the page header: its measured height (--callsheet-header-h), never a
          guessed offset, which left the header floating halfway down the screen on other resolutions */}
      {!isCompact && (
          <header
            className={`${STICKY_UNDER_PAGE_HEADER} z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 rounded-t-xl border-b border-gray-200 dark:border-white/10 mb-4 transition-colors`}>
            <div className="flex items-center justify-between gap-3 min-w-0">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-3 text-gray-900 dark:text-white min-w-0">
                <span className={`w-1.5 h-6 shrink-0 rounded-full ${
                    isBlue ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' :
                    isEmerald ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                    'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                }`}></span>
                <span className="truncate">{title}</span>
              </h2>
              {/* One dropdown instead of a bar with every position: fits any width */}
              <select
                aria-label="Positie van deze kolom"
                value={positionId}
                onChange={(e) => onPositionChange(Number(e.target.value))}
                className="shrink-0 max-w-[45%] truncate text-xs font-bold uppercase tracking-wider py-1.5 pl-2 pr-7 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800 text-gray-700 dark:text-white/80"
              >
                {!allPositions.some((pos) => pos.id === positionId) && <option value={positionId}>Kies positie</option>}
                {allPositions.map((pos) => (
                  <option key={pos.id} value={pos.id} disabled={pos.id !== positionId && (pos.id === secondaryPositionId || pos.id === tertiaryPositionId)}>
                    {pos.name}
                  </option>
                ))}
              </select>
            </div>
          </header>
      )}

      {isCompact && (
           <header
             className={`${STICKY_UNDER_PAGE_HEADER} z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-2 rounded-t-xl border-b border-gray-200 dark:border-white/10 mb-4 transition-colors`}>
            <div className="flex items-center gap-2">
                <span className={`w-1 h-3 rounded-full ${
                    isBlue ? 'bg-blue-500' :
                    isEmerald ? 'bg-emerald-500' :
                    'bg-purple-500'
                }`}></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/70">{title}</span>
            </div>
         </header>
      )}

      <div className="p-4 space-y-4">
        {allTimes.map(timeSlot => {
          // A hoofdstuk heading, at the same height in every column; "niets voor jou" without own items
          if (timeSlot.startsWith('chapter:')) {
            const chapterId = Number(timeSlot.slice('chapter:'.length));
            const own = relevantItems.some(item => item.chapterId === chapterId);
            return (
              <div key={timeSlot} role="heading" aria-level={2}
                   className={`flex items-baseline gap-2 border-b border-gray-300 dark:border-white/15 pt-2 pb-1 min-w-0 ${own ? '' : 'opacity-50'}`}>
                <span className="truncate text-sm font-black uppercase tracking-widest text-gray-700 dark:text-white/80">{chapterName(chapters, chapterId)}</span>
                {!own && <span className="shrink-0 text-xs text-gray-500 dark:text-white/50">— niets voor jou</span>}
              </div>
            );
          }
          const [time, indexStr] = timeSlot.split('#');
          const index = parseInt(indexStr);
          const itemsForTime = itemsByTime[time] || [];
          const item = itemsForTime[index];

          if (item) {
            return (
              <Fragment key={item.id}>
                {wait?.kind === 'waiting' && wait.next.id === item.id && waitRow()}
                <CallSheetItem
                  item={item}
                  compact={isCompactSlot(timeSlot)}
                  isActive={isActive(item.id)}
                  isAutoAdvanceScheduled={autoAdvanceEventId === item.id}
                  elapsedTime={elapsedTime}
                  remainingTimeDisplay={remainingOf(item.id)}
                  isVenueItem={isEmerald}
                />
              </Fragment>
            );
          }
          if (time === activeTime && !waitPlaced) return <Fragment key={timeSlot}>{waitRow()}</Fragment>;
          // Gebruik de CallSheetItem placeholder for perfecte uitlijning
          return (
            <CallSheetItem
              key={timeSlot}
              isPlaceholder={true}
              compact={isCompactSlot(timeSlot)}
              isVenueItem={isEmerald}
            />
          );
        })}
        {waitRow()}
        {relevantItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300 dark:text-white/20 bg-gray-100 dark:bg-white/5 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/5">
            <p className="text-lg font-bold uppercase tracking-widest">Geen items</p>
            <p className="text-xs mt-1">Er zijn geen callsheet items gepland voor deze positie.</p>
          </div>
        )}
      </div>
    </div>
  );
};
