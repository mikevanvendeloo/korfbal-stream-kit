interface DisplayTime {
  minutes: string;
  seconds: string;
  isNegative: boolean;
  rawSeconds: number;
}

interface Props {
  isConnected: boolean;
  timeSinceLastSync: number | null;
  productionClock: DisplayTime;
  activeEventRemainingTime: DisplayTime | null;
  venueClock: string;
  systemTime: string;
  variant?: 'compact' | 'large';
}

export const TimeDisplay = ({
  isConnected,
  timeSinceLastSync,
  productionClock,
  activeEventRemainingTime,
  venueClock,
  systemTime,
  variant = 'compact'
}: Props) => {

  // On phones only the coloured dot is shown; the text stays available as its label
  const status = (className: string, text: string) => (
    <span className={className} title={text} aria-label={text}>● <span className="hidden sm:inline">{text}</span></span>
  );
  const getStatusIndicator = () => {
    if (!isConnected) return status('text-red-500 animate-pulse', 'Verbinding verbroken');
    if (timeSinceLastSync === null) return status('text-yellow-500', 'Synchroniseren...');
    if (timeSinceLastSync > 5) return status('text-yellow-500', 'Sync >5s');
    return status('text-green-500', 'Verbonden');
  };

  const getProductionClockStyle = (isLarge: boolean) => {
    const clock = activeEventRemainingTime || productionClock;
    const { rawSeconds, isNegative } = clock;
    const isCritical = rawSeconds <= 10 || isNegative;

    if (isLarge) {
      return isCritical ? 'text-red-600 dark:text-red-500 animate-pulse' : 'text-gray-900 dark:text-white';
    }

    if (isCritical) {
      return 'bg-red-600 text-white animate-pulse';
    }
    return 'bg-gray-700 text-gray-100';
  };

  const getVenueClockStyle = (isLarge: boolean) => {
    if (isLarge) return 'text-emerald-600 dark:text-emerald-500';
    return 'bg-emerald-700 text-emerald-50';
  };

  const getSystemTimeStyle = (isLarge: boolean) => {
    if (isLarge) return 'text-gray-900 dark:text-white';
    return 'bg-gray-700 text-gray-100';
  };

  const displayClock = activeEventRemainingTime || productionClock;
  const isLarge = variant === 'large';

  if (isLarge) {
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="grid grid-cols-3 gap-4 sm:gap-8">
          {/* Zaal Klok */}
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500/60 block mb-1">
              Zaal
            </span>
            <span className={`text-3xl font-mono font-black tracking-tighter ${getVenueClockStyle(true)}`}>
              {venueClock}
            </span>
          </div>

          {/* Systeem Tijd */}
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-white/40 block mb-1">
              Tijd
            </span>
            <span className={`text-3xl font-mono font-black tracking-tighter ${getSystemTimeStyle(true)}`}>
              {systemTime}
            </span>
          </div>

          {/* Productie Klok */}
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-white/40 block mb-1">
              {activeEventRemainingTime ? 'Resterend' : 'Productie'}
            </span>
            <span className={`text-3xl font-mono font-black tracking-tighter ${getProductionClockStyle(true)}`}>
              {displayClock.isNegative && '-'}
              {displayClock.minutes}:{displayClock.seconds}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-base sm:text-lg font-mono">
      {/* Status Indicator */}
      <div className="text-xs self-center">{getStatusIndicator()}</div>

      {/* Zaal Klok */}
      <div className={`flex flex-col items-center px-2 py-1 sm:p-2 rounded-lg transition-colors ${getVenueClockStyle(false)}`}>
        <span className="text-[10px] sm:text-xs uppercase opacity-80">Zaal</span>
        <span className="font-bold">{venueClock}</span>
      </div>

      {/* Systeem Tijd */}
      <div className={`flex flex-col items-center px-2 py-1 sm:p-2 rounded-lg transition-colors ${getSystemTimeStyle(false)}`}>
        <span className="text-[10px] sm:text-xs uppercase opacity-80">Tijd</span>
        <span className="font-bold">{systemTime}</span>
      </div>

      {/* Productie Klok */}
      <div className={`flex flex-col items-center px-2 py-1 sm:p-2 rounded-lg transition-colors ${getProductionClockStyle(false)}`}>
        <span className="text-[10px] sm:text-xs uppercase opacity-80">{activeEventRemainingTime ? 'Resterend' : 'Productie'}</span>
        <div className="font-bold">
          <span>{displayClock.isNegative && '-'}</span>
          <span>{displayClock.minutes}</span>
          <span>:</span>
          <span>{displayClock.seconds}</span>
        </div>
      </div>
    </div>
  );
};
