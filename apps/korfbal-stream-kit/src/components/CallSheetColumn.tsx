import {CallSheetItem} from './CallSheetItem';
import {Position, ProductionEvent} from '../hooks/useLiveState';

interface Props {
  title: string;
  positionId: number;
  items: (ProductionEvent & { calculatedTime?: Date | null })[];
  activeEvent: ProductionEvent | null;
  elapsedTime: number;
  allTimes: string[];
  allPositions: Position[];
  onPositionChange: (id: number) => void;
  secondaryPositionId: number | null;
  tertiaryPositionId?: number | null;
  accentColor: 'blue' | 'emerald' | 'purple';
}

export const CallSheetColumn = ({
  title,
  positionId,
  items,
  activeEvent,
  elapsedTime,
  allTimes,
  allPositions,
  onPositionChange,
  secondaryPositionId,
  tertiaryPositionId,
  accentColor
}: Props) => {
  const isBlue = accentColor === 'blue';
  const isEmerald = accentColor === 'emerald';
  const isPurple = accentColor === 'purple';

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
    <div className={`bg-black/20 rounded-xl overflow-hidden border border-white/5 shadow-xl transition-all`}>
      {/* Kolom Header met Positie Selectie */}
      <div className={`p-4 bg-gray-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
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
                        ? 'bg-blue-600 text-white'
                        : isEmerald
                          ? 'bg-emerald-600 text-white'
                          : 'bg-purple-600 text-white'
                      : isUsedElsewhere
                        ? 'bg-white/5 text-white/10 cursor-not-allowed'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {pos.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
                elapsedTime={elapsedTime}
              />
            );
          }
          // Gebruik de CallSheetItem placeholder voor perfecte uitlijning
          return (
            <CallSheetItem
              key={timeSlot}
              isPlaceholder={true}
            />
          );
        })}
        {relevantItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-white/20 bg-white/5 rounded-xl border-2 border-dashed border-white/5">
            <p className="text-lg font-bold uppercase tracking-widest">Geen items</p>
            <p className="text-xs mt-1">Er zijn geen callsheet items gepland voor deze positie.</p>
          </div>
        )}
      </div>
    </div>
  );
};
