import {formatSystemTime, ProductionEvent} from '../hooks/useLiveState'; // Importeer de formatSystemTime functie // Importeer de correcte interface
import {useFontSize} from '../hooks/useFontSize';
import {FastForward} from 'lucide-react';

interface Props {
  item?: (ProductionEvent & { calculatedTime?: Date | null }) | null;
  isActive?: boolean;
  isAutoAdvanceScheduled?: boolean;
  elapsedTime?: number;
  isPlaceholder?: boolean;
  hideStreamVenueLabels?: boolean;
}

export const CallSheetItem = ({ item, isActive = false, isAutoAdvanceScheduled = false, elapsedTime = 0, isPlaceholder = false, hideStreamVenueLabels = false }: Props) => {
  const { fontSize } = useFontSize();
  const isActuallyPlaceholder = isPlaceholder || !item;
  const duration = item?.durationSec ?? 0;
  const remainingTime = duration - elapsedTime;

  const isInVenue = item?.isInVenue;
  const isInLivestream = item?.isInLivestream !== false; // Default true if not specified
  const autoAdvance = item?.autoAdvance === true;
  const isLinked = !!item?.parentId;

  const formatDuration = (seconds: number) => {
    const absSeconds = Math.abs(Math.round(seconds));
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  let statusColor = isActuallyPlaceholder ? 'bg-transparent border-dashed border-gray-300 dark:border-white/5 opacity-40' : 'bg-gray-100 dark:bg-gray-700/50';
  let borderColor = isActuallyPlaceholder ? 'border-2' : 'border-transparent';
  const textColor = 'text-gray-900 dark:text-white';
  let timeLabelColor = 'bg-gray-200 dark:bg-gray-900/50';
  let durationBadgeColor = 'bg-gray-300 dark:bg-gray-800/50';

  if (isActive && !isActuallyPlaceholder) {
    borderColor = 'border-gray-900 dark:border-white border-2';
    if (remainingTime < 0) {
      statusColor = 'bg-red-500 dark:bg-red-600 animate-pulse';
      timeLabelColor = 'bg-red-700 dark:bg-red-800';
      durationBadgeColor = 'bg-red-800/50 dark:bg-red-900/50';
    } else if (remainingTime <= 10) {
      statusColor = 'bg-orange-500';
      timeLabelColor = 'bg-orange-600 dark:bg-orange-700';
      durationBadgeColor = 'bg-orange-700/50 dark:bg-orange-800/50';
    } else {
      statusColor = 'bg-green-500 dark:bg-green-600';
      timeLabelColor = 'bg-green-700 dark:bg-green-800';
      durationBadgeColor = 'bg-green-800/50 dark:bg-green-900/50';
    }
  } else if (isLinked && !isActuallyPlaceholder) {
    statusColor = 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30';
    borderColor = 'border-2';
  }

  const displayTime = !isActuallyPlaceholder && item.calculatedTime
    ? formatSystemTime(item.calculatedTime)
    : (!isActuallyPlaceholder && item.actualStartTime
      ? formatSystemTime(new Date(item.actualStartTime))
      : (!isActuallyPlaceholder && (item as any).timeStart
        ? formatSystemTime(new Date((item as any).timeStart))
        : (!isActuallyPlaceholder && (item as any).plannedStartTime
          ? formatSystemTime(new Date((item as any).plannedStartTime))
          : '00:00:00')));

    const getFontSizeClass = (base: string, large: string, xl: string) => {
      if (fontSize === 'l') return large;
      if (fontSize === 'xl') return xl;
      return base;
    };

    const getPaddingClass = () => {
        if (fontSize === 'l') return 'p-5';
        if (fontSize === 'xl') return 'p-7';
        return 'p-3';
    };

    return (
    <div
      id={item?.id ? `event-${item.id}` : undefined}
      className={`${getPaddingClass()} rounded-lg border-2 shadow-sm ${statusColor} ${borderColor} ${textColor} transition-all`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        {/* Linker kolom: Tijdstip en Countdown */}
        <div className="flex flex-col gap-2 w-full sm:w-auto flex-shrink-0">
          {/* Tijd Label */}
          <div className={`px-4 py-2.5 rounded font-mono font-bold ${getFontSizeClass('text-lg', 'text-2xl', 'text-4xl')} tracking-tighter whitespace-nowrap shadow-inner text-center sm:text-left ${timeLabelColor} ${isActuallyPlaceholder ? 'invisible' : 'text-gray-900 dark:text-white'}`}>
            {displayTime}
          </div>

          {/* Countdown / Resterende tijd */}
          {isActive && !isActuallyPlaceholder && (
            <div className={`px-4 py-3 rounded-md font-mono font-black ${getFontSizeClass('text-xl', 'text-4xl', 'text-6xl')} text-center shadow-lg border border-white/10 ${
              remainingTime < 0 ? 'bg-red-800 dark:bg-red-900/80 text-white' :
              remainingTime <= 10 ? 'bg-orange-700 dark:bg-orange-800/80 text-white' :
              'bg-green-700 dark:bg-green-800/80 text-white'
            }`}>
              {formatDuration(remainingTime)}
            </div>
          )}
        </div>

        {/* Rechter kolom: Inhoud */}
        <div className="flex-grow min-w-0 w-full">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-bold ${getFontSizeClass('text-lg', 'text-3xl', 'text-5xl')} leading-tight pt-0.5 ${isActuallyPlaceholder ? 'invisible bg-gray-200 dark:bg-white/5 rounded h-6 w-1/3' : ''}`}>
              {item?.title || '\u00A0'}
            </h3>
            {((duration >= 0) || isActuallyPlaceholder) && (
              <div
                title={`${duration} seconden`}
                className={`px-3 py-1 rounded ${getFontSizeClass('text-lg', 'text-2xl', 'text-4xl')} font-mono font-bold ${durationBadgeColor} border border-gray-300 dark:border-white/10 whitespace-nowrap flex-shrink-0 mt-1 ${isActuallyPlaceholder ? 'invisible bg-gray-200 dark:bg-white/5 h-5 w-10' : isActive ? 'text-white' : ''}`}
              >
                {formatDuration(duration)}
              </div>
            )}
          </div>

          {item?.note && <p className={`${getFontSizeClass('text-sm', 'text-xl', 'text-2xl')} text-gray-600 dark:text-gray-300/80 mt-2 italic leading-snug`}>{item.note}</p>}
          {(isActuallyPlaceholder || !item?.note) && (
            <p className={`${getFontSizeClass('text-sm', 'text-base', 'text-lg')} text-gray-600 dark:text-gray-300/80 mt-1 italic border-t border-gray-200 dark:border-white/10 pt-1 ${isActuallyPlaceholder ? 'invisible' : ''}`}>
              &nbsp;
            </p>
          )}

          <div className={`flex flex-wrap items-center justify-between mt-2 pt-1 border-t border-gray-200 dark:border-white/10 ${getFontSizeClass('text-[10px]', 'text-lg', 'text-xl')} font-medium uppercase tracking-wider opacity-80 min-h-[1.25rem] ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            <div className="flex gap-2">
              {!hideStreamVenueLabels && isInLivestream && (
                <span className="flex items-center gap-2 text-blue-400"><span className={`${getFontSizeClass('w-1.5 h-1.5', 'w-3 h-3', 'w-4 h-4')} rounded-full bg-blue-500`}></span>Stream</span>
              )}
              {!hideStreamVenueLabels && isInVenue && (
                <span className="flex items-center gap-2 text-orange-400"><span className={`${getFontSizeClass('w-1.5 h-1.5', 'w-3 h-3', 'w-4 h-4')} rounded-full bg-orange-500`}></span>Zaal</span>
              )}
              {autoAdvance && (
                <span className={`flex items-center gap-2 ${isAutoAdvanceScheduled ? 'text-purple-300' : 'text-purple-400'}`}>
                  <FastForward className={`${getFontSizeClass('w-3 h-3', 'w-5 h-5', 'w-7 h-7')} ${isAutoAdvanceScheduled ? 'animate-pulse scale-125' : ''}`} />
                  Auto {isAutoAdvanceScheduled && <span className="text-[0.8em] font-black italic ml-1">TIMER</span>}
                </span>
              )}
              {!hideStreamVenueLabels && isLinked && (
                <span className="flex items-center gap-2 text-blue-400"><span className={`${getFontSizeClass('w-1.5 h-1.5', 'w-3 h-3', 'w-4 h-4')} rounded-full bg-blue-500`}></span>Link</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
