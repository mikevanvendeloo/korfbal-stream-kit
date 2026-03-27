import React from 'react';

interface GlobalClocksProps {
    productionTime: number;
    scoreboardTime: number;
}

const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
};

export const GlobalClocks: React.FC<GlobalClocksProps> = ({ productionTime, scoreboardTime }) => {
    return (
        <div className="grid grid-cols-2 gap-4 text-center p-4 bg-black rounded-lg">
            <div>
                <h2 className="text-lg font-bold text-gray-400">Productie Tijd</h2>
                <p className="text-5xl font-mono tracking-widest">{formatTime(productionTime)}</p>
            </div>
            <div>
                <h2 className="text-lg font-bold text-orange-500">Zaal Klok</h2>
                <p className="text-5xl font-mono tracking-widest text-orange-400">{formatTime(scoreboardTime)}</p>
            </div>
        </div>
    );
};
