import {formatSystemTime, ProductionEvent} from '../hooks/useLiveState'; // Importeer de formatSystemTime functie // Importeer de correcte interface

interface Props {
  item?: (ProductionEvent & { calculatedTime?: Date | null }) | null;
  isActive?: boolean;
  elapsedTime?: number;
  isPlaceholder?: boolean;
}

export const CallSheetItem = ({ item, isActive = false, elapsedTime = 0, isPlaceholder = false }: Props) => {
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

  let statusColor = isActuallyPlaceholder ? 'bg-transparent border-dashed border-white/5 opacity-40' : 'bg-gray-700/50';
  let borderColor = isActuallyPlaceholder ? 'border-2' : 'border-transparent';
  const textColor = 'text-white';
  let timeLabelColor = 'bg-gray-900/50';
  let durationBadgeColor = 'bg-gray-800/50';

  if (isActive && !isActuallyPlaceholder) {
    borderColor = 'border-white border-2';
    if (remainingTime < 0) {
      statusColor = 'bg-red-600 animate-pulse';
      timeLabelColor = 'bg-red-800';
      durationBadgeColor = 'bg-red-900/50';
    } else if (remainingTime <= 10) {
      statusColor = 'bg-orange-500';
      timeLabelColor = 'bg-orange-700';
      durationBadgeColor = 'bg-orange-800/50';
    } else {
      statusColor = 'bg-green-600';
      timeLabelColor = 'bg-green-800';
      durationBadgeColor = 'bg-green-900/50';
    }
  } else if (isLinked && !isActuallyPlaceholder) {
    statusColor = 'bg-blue-900/20 border-blue-500/30';
    borderColor = 'border-2';
  }

  const displayTime = !isActuallyPlaceholder && item.calculatedTime
    ? formatSystemTime(item.calculatedTime)
    : (!isActuallyPlaceholder && item.actualStartTime
      ? formatSystemTime(new Date(item.actualStartTime))
      : (!isActuallyPlaceholder && (item as any).timeStart
        ? formatSystemTime(new Date((item as any).timeStart))
        : '00:00:00'));

  return (
    <div
      id={item?.id ? `event-${item.id}` : undefined}
      className={`p-3 rounded-lg border-2 shadow-sm ${statusColor} ${borderColor} ${textColor} transition-all`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        {/* Linker kolom: Tijdstip en Countdown */}
        <div className="flex flex-col gap-2 w-full sm:w-auto flex-shrink-0">
          {/* Tijd Label */}
          <div className={`px-3 py-1.5 rounded font-mono font-bold text-sm tracking-tighter whitespace-nowrap shadow-inner text-center sm:text-left ${timeLabelColor} ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            {displayTime}
          </div>

          {/* Countdown / Resterende tijd */}
          {isActive && !isActuallyPlaceholder && (
            <div className={`px-3 py-2 rounded-md font-mono font-black text-xl text-center shadow-lg border border-white/10 ${
              remainingTime < 0 ? 'bg-red-900/80 text-white' :
              remainingTime <= 10 ? 'bg-orange-800/80 text-white' :
              'bg-green-800/80 text-white'
            }`}>
              {formatDuration(remainingTime)}
            </div>
          )}
        </div>

        {/* Rechter kolom: Inhoud */}
        <div className="flex-grow min-w-0 w-full">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-bold text-lg leading-tight pt-0.5 ${isActuallyPlaceholder ? 'invisible bg-white/5 rounded h-6 w-1/3' : ''}`}>
              {item?.title || '\u00A0'}
            </h3>
            {((duration > 0) || isActuallyPlaceholder) && (
              <div
                title={`${duration} seconden`}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${durationBadgeColor} border border-white/10 whitespace-nowrap flex-shrink-0 mt-1 ${isActuallyPlaceholder ? 'invisible bg-white/5 h-5 w-10' : ''}`}
              >
                {formatDuration(duration)}
              </div>
            )}
          </div>

          {item?.note && <p className="text-sm text-gray-300/80 mt-1 italic leading-snug">{item.note}</p>}
          {(isActuallyPlaceholder || !item?.note) && (
            <p className={`text-sm text-gray-300/80 mt-1 italic border-t border-white/10 pt-1 ${isActuallyPlaceholder ? 'invisible' : ''}`}>
              &nbsp;
            </p>
          )}

          <div className={`flex flex-wrap items-center justify-between mt-2 pt-1 border-t border-white/10 text-[10px] font-medium uppercase tracking-wider opacity-80 min-h-[1.25rem] ${isActuallyPlaceholder ? 'invisible' : ''}`}>
            <div className="flex gap-2">
              {isInLivestream && (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Stream
                </span>
              )}
              {isInVenue && (
                <span className="flex items-center gap-1 text-orange-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Zaal
                </span>
              )}
              {autoAdvance && (
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Auto
                </span>
              )}
              {isLinked && (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Link
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
