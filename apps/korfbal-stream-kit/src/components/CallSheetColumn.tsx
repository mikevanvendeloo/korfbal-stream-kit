import {CallSheetItem} from './CallSheetItem';
import {ProductionEvent} from '../hooks/useLiveState'; // Importeer de correcte interface

interface Props {
  title: string;
  positionId: number;
  items: ProductionEvent[]; // Gebruik de geïmporteerde ProductionEvent
  activeEvent: ProductionEvent | null;
  elapsedTime: number;
}

export const CallSheetColumn = ({ title, positionId, items, activeEvent, elapsedTime }: Props) => {
  // Filter de items die relevant zijn voor de positie van deze kolom.
  // Een item is relevant als de 'positions' array de 'positionId' van deze kolom bevat.
  // OF als een item geen specifieke posities heeft (generiek voor iedereen).
  const relevantItems = items.filter(item =>
    item.positions.length === 0 || item.positions.some(p => p.position.id === positionId)
  );

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 h-full">
      <h2 className="text-xl font-bold mb-4 sticky top-0 bg-gray-900 py-2 z-10">{title}</h2>
      <div className="space-y-3">
        {relevantItems.map(item => (
          <CallSheetItem
            key={item.id}
            item={item}
            isActive={activeEvent?.id === item.id}
            elapsedTime={elapsedTime}
          />
        ))}
        {relevantItems.length === 0 && (
          <p className="text-gray-500 text-center mt-8">Geen items voor deze positie.</p>
        )}
      </div>
    </div>
  );
};
