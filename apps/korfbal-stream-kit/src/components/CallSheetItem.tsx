import {formatSystemTime, ProductionEvent} from '../hooks/useLiveState'; // Importeer de formatSystemTime functie // Importeer de correcte interface

interface Props {
  item: ProductionEvent;
  isActive: boolean;
  elapsedTime: number;
}

export const CallSheetItem = ({ item, isActive, elapsedTime }: Props) => {
  const duration = item.durationSec ?? 0; // Gebruik 0 als default als durationSec null is
  const remainingTime = duration - elapsedTime;

  let bgColor = 'bg-gray-800';
  if (isActive) {
    if (remainingTime < 0) {
      bgColor = 'bg-red-600 animate-pulse'; // Te lang bezig
    } else if (remainingTime <= 10) {
      bgColor = 'bg-orange-500'; // Bijna voorbij
    } else {
      bgColor = 'bg-green-600'; // Actief
    }
  }

  // Gebruik actualStartTime als die er is, anders timeStart (als string of Date)
  const displayTime = item.actualStartTime
    ? formatSystemTime(new Date(item.actualStartTime))
    : (item as any).timeStart // Cast naar any om timeStart te benaderen
      ? formatSystemTime(new Date((item as any).timeStart))
      : '';

  return (
    <div className={`p-4 rounded-lg border-2 ${isActive ? 'border-white' : 'border-transparent'} ${bgColor}`}>
      <h3 className="font-bold text-lg">{displayTime} {item.title}</h3> {/* Toon de geformatteerde tijd */}
      {item.note && <p className="text-sm text-gray-300">{item.note}</p>}
      <div className="flex justify-between mt-2 text-xs">
        {duration > 0 && <span>Duur: {duration}s</span>}
        {isActive && <span>Resterend: {Math.round(remainingTime)}s</span>}
      </div>
    </div>
  );
};
