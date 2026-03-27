import React from 'react';
import { useParams } from 'react-router-dom';
import { useCallsheetSync } from '../hooks/useCallsheetSync';
import { GlobalClocks } from '../components/callsheet/GlobalClocks';
import { CallsheetColumn } from '../components/callsheet/CallsheetColumn';
import { DirectorControls } from '../components/callsheet/DirectorControls';

export const CallsheetPage: React.FC = () => {
    const { positionId } = useParams<{ positionId: string }>();
    const { state, isLoading, error } = useCallsheetSync();

    if (isLoading) return <div>Loading callsheet...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;
    if (!state) return <div>Waiting for production state...</div>;

    const positionIdNum = Number(positionId);

    return (
        <div className="bg-gray-900 min-h-screen text-white p-4 flex flex-col">
            <header className="w-full mb-4">
                <GlobalClocks
                    productionTime={state.clocks.productionTime}
                    scoreboardTime={state.clocks.scoreboardTime}
                />
            </header>

            <main className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                <CallsheetColumn
                    positionId={positionIdNum}
                    activeEventId={state.activeEventId}
                    productionTime={state.clocks.productionTime}
                />
                <CallsheetColumn
                    positionId={1} // Assuming 1 is the ID for "Regie Livestream"
                    title="Regie Livestream"
                    activeEventId={state.activeEventId}
                    productionTime={state.clocks.productionTime}
                />
            </main>

            <footer className="w-full mt-4">
                <DirectorControls />
            </footer>
        </div>
    );
};
