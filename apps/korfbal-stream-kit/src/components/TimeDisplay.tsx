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
  venueClock: string;
  systemTime: string;
}

export const TimeDisplay = ({ isConnected, timeSinceLastSync, productionClock, venueClock, systemTime }: Props) => {

  const getStatusIndicator = () => {
    if (!isConnected) return <span className="text-red-500 animate-pulse">● Verbinding verbroken</span>;
    if (timeSinceLastSync === null) return <span className="text-yellow-500">● Synchroniseren...</span>;
    if (timeSinceLastSync > 5) return <span className="text-yellow-500">● Sync &gt;5s</span>;
    return <span className="text-green-500">● Verbonden</span>;
  };

  const getProductionClockStyle = () => {
    const { rawSeconds } = productionClock;
    if (rawSeconds <= 0) {
      return 'bg-red-600 text-white';
    }
    if (rawSeconds <= 10) {
      return 'bg-orange-500 text-white';
    }
    return 'bg-gray-700 text-gray-100';
  };

  return (
    <div className="flex items-center gap-4 text-lg font-mono">
      {/* Status Indicator */}
      <div className="text-xs self-center">{getStatusIndicator()}</div>

      {/* Systeem Tijd */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700 text-gray-100">
        <span className="text-xs uppercase text-gray-400">Echte Tijd</span>
        <span className="font-bold">{systemTime}</span>
      </div>

      {/* Zaal Klok */}
      <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700 text-gray-100">
        <span className="text-xs uppercase text-gray-400">Zaal Klok</span>
        <span className="font-bold">{venueClock}</span>
      </div>

      {/* Productie Klok */}
      <div className={`flex flex-col items-center p-2 rounded-lg transition-colors ${getProductionClockStyle()}`}>
        <span className="text-xs uppercase opacity-80">Productie</span>
        <div className="font-bold">
          <span>{productionClock.isNegative && '-'}</span>
          <span>{productionClock.minutes}</span>
          <span>:</span>
          <span>{productionClock.seconds}</span>
        </div>
      </div>
    </div>
  );
};
