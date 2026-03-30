import React from 'react';
import {useParams} from 'react-router-dom';
import {MdNavigateBefore, MdNavigateNext, MdPlayArrow} from 'react-icons/md';
import {useLiveState} from '../hooks/useLiveState';

export const ShowControl = () => {
  const { productionId } = useParams<{ productionId: string }>();
  const { activeEvent } = useLiveState();

  const handleApiCall = async (endpoint: string) => {
    try {
      const response = await fetch(`/api/show/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to trigger ${endpoint}:`, errorData.error || 'Unknown error');
        // Hier kun je een gebruikersnotificatie tonen
      }
    } catch (error) {
      console.error(`API call to ${endpoint} failed:`, error);
    }
  };

  const handleStart = () => handleApiCall(`start/${productionId}`);
  const handleNext = () => handleApiCall('next');
  const handlePrevious = () => handleApiCall('previous'); // Let op: de backend voor 'previous' moet nog worden geïmplementeerd.

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg border border-gray-700 shadow-2xl flex items-center gap-3">
      <button
        onClick={handleStart}
        title={activeEvent ? "Herstart Show" : "Start Show"}
        className={`${activeEvent ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'} text-white font-bold p-3 rounded-full flex items-center justify-center transition-colors shadow-lg`}
      >
        <MdPlayArrow className="w-6 h-6" />
      </button>
      <div className="flex gap-2 items-center border-l border-gray-700 pl-3">
        <button
          onClick={handlePrevious}
          disabled={!activeEvent}
          title="Vorig Item"
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold p-2.5 rounded-full flex items-center justify-center transition-colors"
        >
          <MdNavigateBefore className="w-6 h-6" />
        </button>
        <button
          onClick={handleNext}
          disabled={!activeEvent}
          title="Volgend Item"
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold p-3 rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <MdNavigateNext className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
