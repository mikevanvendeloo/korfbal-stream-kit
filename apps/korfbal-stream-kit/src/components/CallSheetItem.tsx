import {formatSystemTime, ProductionEvent} from '../hooks/useLiveState'; // Importeer de formatSystemTime functie // Importeer de correcte interface
import {useFontSize} from '../hooks/useFontSize';
import {FastForward} from 'lucide-react';
import {InterviewText} from './InterviewText';

interface Props {
  item?: (ProductionEvent & { calculatedTime?: Date | null }) | null;
  isActive?: boolean;
  isAutoAdvanceScheduled?: boolean;
  elapsedTime?: number;
  remainingTimeDisplay?: { minutes: string; seconds: string; isNegative: boolean; rawSeconds: number } | null;
  isPlaceholder?: boolean;
  hideStreamVenueLabels?: boolean;
  isVenueItem?: boolean;
  isTimeAnchor?: boolean;
  /** Photos of the chosen interview people next to their names (when the setting is on) */
  showInterviewPhotos?: boolean;
  /** One compact line instead of the full card (items after the current and the next one) */
  compact?: boolean;
}

export const CallSheetItem = ({ item, isActive = false, isAutoAdvanceScheduled = false, elapsedTime = 0, remainingTimeDisplay = null, isPlaceholder = false, hideStreamVenueLabels = false, isVenueItem = false, isTimeAnchor = false, showInterviewPhotos = true, compact = false }: Props) => {
  const { fontSize } = useFontSize();
  const isActuallyPlaceholder = isPlaceholder || !item;
  const duration = item?.durationSec ?? 0;

  // Gebruik de voorberekende resterende tijd indien beschikbaar, anders herberekenen
  const remainingTime = remainingTimeDisplay ? remainingTimeDisplay.rawSeconds : (duration - elapsedTime);

  const isInVenue = item?.isInVenue;
  const isInLivestream = item?.isInLivestream !== false; // Default true if not specified
  const autoAdvance = item?.autoAdvance === true;
  const isLinked = !!item?.parentId;
  const isAnchor = isTimeAnchor || item?.isTimeAnchor || item?.title === 'Start wedstrijd';

  const formatDuration = (seconds: number) => {
    const absSeconds = Math.abs(Math.round(seconds));
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  let statusColor = isActuallyPlaceholder ? 'bg-transparent border-dashed border-gray-300 dark:border-white/5 opacity-40' : (isVenueItem ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-gray-100 dark:bg-gray-700/50');
  let borderColor = isActuallyPlaceholder ? 'border-2' : (isVenueItem ? 'border-2' : 'border-transparent');
  const textColor = 'text-gray-900 dark:text-white';
  let timeLabelColor = isVenueItem ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-200 dark:bg-gray-900/50';
  let durationBadgeColor = isVenueItem ? 'bg-emerald-200/50 dark:bg-emerald-800/40' : 'bg-gray-300 dark:bg-gray-800/50';

  if (isAnchor && !isActuallyPlaceholder) {
    statusColor = 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30';
    borderColor = 'border-2 border-amber-400 dark:border-amber-500/50';
    timeLabelColor = 'bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100';
    durationBadgeColor = 'bg-amber-300/50 dark:bg-amber-800/40 text-amber-900 dark:text-amber-100';
  }

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

    const getFontSizeClass = (small: string, base: string, large: string, xl: string) => {
      if (fontSize === 's') return small;
      if (fontSize === 'l') return large;
      if (fontSize === 'xl') return xl;
      return base;
    };

    const getPaddingClass = () => {
        if (fontSize === 's') return 'p-1.5';
        if (fontSize === 'l') return 'p-3';
        if (fontSize === 'xl') return 'p-4';
        return 'p-2';
    };

    // Compact: one line with time, title, auto, lanes and duration (items after the current and the next one)
    if (compact) {
      const compactColor = isActuallyPlaceholder ? 'border-dashed border-gray-300 dark:border-white/5 opacity-40'
        : isAnchor ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-500/40'
          : isVenueItem ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-500/20'
            : 'bg-gray-100 dark:bg-gray-700/50 border-transparent';
      const tag = `rounded px-1 font-semibold uppercase ${getFontSizeClass('text-[8px]', 'text-[10px]', 'text-sm', 'text-base')}`;
      return (
        <div id={item?.id ? `event-${item.id}` : undefined} data-compact=""
             className={`flex items-baseline gap-3 px-3 py-1 rounded-lg border ${compactColor} ${textColor}`}>
          <span className={`font-mono tabular-nums shrink-0 text-gray-600 dark:text-gray-300 ${getFontSizeClass('text-xs', 'text-sm', 'text-xl', 'text-2xl')} ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            {displayTime.slice(0, 5)}
          </span>
          {/* Top-aligned with the time and the duration: a long title wraps below its first line (one line on a large screen) */}
          <span className={`flex-1 min-w-0 leading-snug font-semibold lg:truncate ${getFontSizeClass('text-sm', 'text-base', 'text-2xl', 'text-3xl')} ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            {item?.title ? <InterviewText text={item.title} photos={showInterviewPhotos}/> : ' '}
          </span>
          {!isActuallyPlaceholder && (autoAdvance || !hideStreamVenueLabels) && (
            <span className="flex shrink-0 items-center gap-1">
              {autoAdvance && <AutoMark scheduled={isAutoAdvanceScheduled} className={getFontSizeClass('w-3.5 h-3.5', 'w-4 h-4', 'w-6 h-6', 'w-7 h-7')}/>}
              {!hideStreamVenueLabels && isInLivestream && <span className={`${tag} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`}>Stream</span>}
              {!hideStreamVenueLabels && isInVenue && <span className={`${tag} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`}>Zaal</span>}
            </span>
          )}
          <span className={`font-mono tabular-nums shrink-0 text-gray-500 ${getFontSizeClass('text-[10px]', 'text-xs', 'text-lg', 'text-xl')} ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            {formatDuration(duration)}
          </span>
        </div>
      );
    }

    const badge = `px-2 py-0.5 rounded-full font-bold ${getFontSizeClass('text-[8px]', 'text-[9px]', 'text-base', 'text-lg')}`;
    return (
    <div
      id={item?.id ? `event-${item.id}` : undefined}
      className={`${getPaddingClass()} rounded-lg border-2 shadow-sm ${statusColor} ${borderColor} ${textColor} transition-all`}
    >
      {/* Time (and countdown) left of the title on every screen: no stacked block on a phone */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 shrink-0">
          <div className={`px-2 py-1 rounded font-mono font-bold ${getFontSizeClass('text-sm', 'text-base', 'text-2xl', 'text-4xl')} tracking-tighter whitespace-nowrap text-center ${timeLabelColor} ${isActuallyPlaceholder ? 'invisible' : 'text-gray-900 dark:text-white'}`}>
            {displayTime}
          </div>
          {isActive && !isActuallyPlaceholder && (
            <div className={`px-2 py-1 rounded-md font-mono font-black ${getFontSizeClass('text-base', 'text-xl', 'text-4xl', 'text-6xl')} text-center shadow ${
              remainingTime < 0 ? 'bg-red-800 dark:bg-red-900/80 text-white' :
              remainingTime <= 10 ? 'bg-orange-700 dark:bg-orange-800/80 text-white' :
              'bg-green-700 dark:bg-green-800/80 text-white'
            }`}>
              {remainingTimeDisplay
                ? `${remainingTimeDisplay.isNegative ? '-' : ''}${remainingTimeDisplay.minutes}:${remainingTimeDisplay.seconds}`
                : formatDuration(remainingTime)
              }
            </div>
          )}
        </div>

        {/* pt-1: the first line of the title on the height of the time inside its padded block */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            {/* Top-aligned with the time and the duration: a long title wraps below its first line (one line on a large screen) */}
            <h3 className={`min-w-0 font-bold ${getFontSizeClass('text-base', 'text-lg', 'text-3xl', 'text-5xl')} leading-tight lg:truncate ${isActuallyPlaceholder ? 'invisible' : ''}`}>
              {item?.title ? <InterviewText text={item.title} photos={showInterviewPhotos}/> : ' '}
            </h3>
            <div
              title={`${duration} seconden`}
              className={`px-2 py-0.5 rounded ${getFontSizeClass('text-sm', 'text-base', 'text-2xl', 'text-4xl')} font-mono font-bold ${durationBadgeColor} border border-gray-300 dark:border-white/10 whitespace-nowrap shrink-0 ${isActuallyPlaceholder ? 'invisible' : isActive ? 'text-white' : ''}`}
            >
              {formatDuration(duration)}
            </div>
          </div>

          {/* Lanes, auto and link; no toelichting and no positions (those belong to the editor). Always one row, so
              placeholders in other columns keep the same height */}
          <div className={`flex flex-wrap items-center gap-1.5 mt-1 min-h-[1.25rem] uppercase tracking-wider ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            {!hideStreamVenueLabels && isInLivestream && (
              <span className={`${badge} border border-blue-400/30 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400`}>Stream</span>
            )}
            {!hideStreamVenueLabels && isInVenue && (
              <span className={`${badge} border border-emerald-400/30 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400`}>Zaal</span>
            )}
            {autoAdvance && (
              <span className={`flex items-center gap-1 font-bold ${getFontSizeClass('text-[8px]', 'text-[10px]', 'text-lg', 'text-xl')} text-purple-800 dark:text-purple-300`}>
                <AutoMark scheduled={isAutoAdvanceScheduled} className={getFontSizeClass('w-4 h-4', 'w-5 h-5', 'w-7 h-7', 'w-8 h-8')}/>
                Auto {isAutoAdvanceScheduled && <span className="font-black italic ml-1">TIMER</span>}
              </span>
            )}
            {!hideStreamVenueLabels && isLinked && (
              <span className={`${badge} border border-blue-400/30 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400`}>Link</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** The item goes on by itself (auto-advance); pulses while its timer runs */
function AutoMark({scheduled, className}: {scheduled: boolean; className: string}) {
  return (
    <FastForward aria-label={scheduled ? 'Gaat automatisch door, timer loopt' : 'Gaat automatisch door'}
                 className={`text-purple-700 dark:text-purple-300 ${className} ${scheduled ? 'animate-pulse scale-125' : ''}`}/>
  );
}
