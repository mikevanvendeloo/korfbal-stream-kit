import React from 'react';
import { useParams } from 'react-router-dom';
import { MdNavigateNext, MdNavigateBefore, MdPlayArrow } from 'react-icons/md';

export const ShowControl = () => {
  const { productionId } = useParams<{ productionId: string }>();

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
        title="Start Show"
        className="bg-green-600 hover:bg-green-500 text-white font-bold p-3 rounded-full flex items-center justify-center transition-colors"
      >
        <MdPlayArrow className="w-6 h-6" />
      </button>
      <div className="flex gap-2">
        <button
          onClick={handlePrevious}
          title="Vorig Item"
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-full flex items-center justify-center transition-colors"
        >
          <MdNavigateBefore className="w-6 h-6" />
        </button>
        <button
          onClick={handleNext}
          title="Volgend Item"
          className="bg-orange-500 hover:bg-orange-400 text-white font-bold p-4 rounded-full flex items-center justify-center transition-colors"
        >
          <MdNavigateNext className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
