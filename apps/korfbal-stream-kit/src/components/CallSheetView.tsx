import {useParams} from 'react-router-dom';
import {CallSheetColumn} from './CallSheetColumn';
import {ShowControl} from './ShowControl';
import {TimeDisplay} from './TimeDisplay';
import {TimeControls} from './TimeControls';
import {useLiveState} from '../hooks/useLiveState';

// Helper om een naam om te zetten naar een URL-vriendelijke slug
const toSlug = (name: string) => {
  return name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
};

export const CallSheetView = () => {
  const { productionId, positionSlug } = useParams<{ productionId: string; positionSlug: string }>();

  const {
    allItems,
    allPositions, // Nu beschikbaar via de hook
    isConnected,
    timeSinceLastSync,
    activeEvent,
    productionClock,
    venueClock,
    systemTime,
    activeEventElapsedTime
  } = useLiveState();

  // Zoek de ID van de geselecteerde positie
  const primaryPosition = allPositions.find(pos => toSlug(pos.name) === positionSlug);
  const primaryPositionId = primaryPosition?.id ?? -1; // -1 als niet gevonden

  // Zoek de ID van de "Regie Livestream" positie
  const streamRegiePosition = allPositions.find(pos => pos.name === 'Regie livestream');
  const streamRegiePositionId = streamRegiePosition?.id ?? -2; // -2 als niet gevonden

  if (!primaryPosition) {
    return (
      <div className="bg-gray-900 min-h-screen text-white p-4 flex items-center justify-center">
        <p className="text-red-500">Geselecteerde positie "{positionSlug}" niet gevonden voor deze productie.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4">
      <header className="flex justify-between items-start mb-4 p-3 bg-black/30 rounded-lg backdrop-blur-sm sticky top-4 z-20 border border-gray-700">
        <div>
          <h1 className="text-2xl font-bold">Live Call Sheet</h1>
          <p className="text-gray-400">Positie: {primaryPosition.name.toUpperCase()}</p>
        </div>
        <TimeDisplay
          isConnected={isConnected}
          timeSinceLastSync={timeSinceLastSync}
          productionClock={productionClock}
          venueClock={venueClock}
          systemTime={systemTime}
        />
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CallSheetColumn
          title={primaryPosition.name.toUpperCase()}
          positionId={primaryPositionId}
          items={allItems}
          activeEvent={activeEvent}
          elapsedTime={activeEventElapsedTime}
        />
        <CallSheetColumn
          title="Regie livestream"
          positionId={streamRegiePositionId}
          items={allItems}
          activeEvent={activeEvent}
          elapsedTime={activeEventElapsedTime}
        />
      </main>

      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <ShowControl />
        <TimeControls />
      </footer>
    </div>
  );
};
