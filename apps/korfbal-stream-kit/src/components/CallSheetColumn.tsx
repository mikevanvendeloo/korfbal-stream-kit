import {CallSheetItem} from './CallSheetItem';
import {Position, ProductionEvent} from '../hooks/useLiveState';

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
  isCompact?: boolean;
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
  isCompact = false
}: Props) => {
  const isBlue = accentColor === 'blue';
  const isEmerald = accentColor === 'emerald';

  // Filter de items die relevant zijn voor de positie van deze kolom.
  const relevantItems = items.filter(item =>
    item.positions.length === 0 || item.positions.some(p => p.position.id === positionId)
  );

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
      {!isCompact && (
          <header
            className="sticky top-[300px] sm:top-[220px] lg:top-[120px] z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 rounded-t-xl border-b border-gray-200 dark:border-white/10 mb-4 transition-colors">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-3 text-gray-900 dark:text-white">
                <span className={`w-1.5 h-6 rounded-full ${
                    isBlue ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' :
                    isEmerald ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                    'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                }`}></span>
                {title}
              </h2>
            </div>

            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
              {allPositions.map(pos => {
                const isSelected = pos.id === positionId;
                const isUsedElsewhere = pos.id === secondaryPositionId || pos.id === tertiaryPositionId;

                return (
                  <button
                    key={pos.id}
                    onClick={() => onPositionChange(pos.id)}
                    disabled={isUsedElsewhere}
                    className={`text-[10px] py-1.5 px-3 rounded-md font-bold transition-all whitespace-nowrap uppercase tracking-wider ${
                      isSelected
                        ? isBlue
                          ? 'bg-blue-600 text-white shadow-md'
                          : isEmerald
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-purple-600 text-white shadow-md'
                        : isUsedElsewhere
                          ? 'bg-black/5 dark:bg-white/5 text-gray-300 dark:text-white/10 cursor-not-allowed'
                          : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {pos.name}
                  </button>
                );
              })}
            </div>
          </div>
          </header>
      )}

      {isCompact && (
           <header
             className="sticky top-[200px] sm:top-[200px] lg:top-[100px] z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-2 rounded-t-xl border-b border-gray-200 dark:border-white/10 mb-4 transition-colors">
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
          const [time, indexStr] = timeSlot.split('#');
          const index = parseInt(indexStr);
          const itemsForTime = itemsByTime[time] || [];
          const item = itemsForTime[index];

          if (item) {
            return (
              <CallSheetItem
                key={item.id}
                item={item}
                isActive={activeEvent?.id === item.id}
                isAutoAdvanceScheduled={autoAdvanceEventId === item.id}
                elapsedTime={elapsedTime}
              />
            );
          }
          // Gebruik de CallSheetItem placeholder for perfecte uitlijning
          return (
            <CallSheetItem
              key={timeSlot}
              isPlaceholder={true}
            />
          );
        })}
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
