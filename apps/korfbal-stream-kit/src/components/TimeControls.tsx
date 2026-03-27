import React, { useState } from 'react';
import { MdPlayArrow, MdStop, MdTimer } from 'react-icons/md';

export const TimeControls = () => {
  const [countdown, setCountdown] = useState(300); // Default 5 minuten

  const handleApiCall = async (endpoint: string, body?: object) => {
    try {
      const response = await fetch(`/api/time/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        console.error(`Failed to trigger ${endpoint}`);
      }
    } catch (error) {
      console.error(`API call to ${endpoint} failed:`, error);
    }
  };

  const handleStart = () => handleApiCall('start');
  const handleStop = () => handleApiCall('stop');
  const handleSetCountdown = () => {
    const seconds = parseInt(prompt('Voer aantal seconden in voor countdown:', String(countdown)) || '0', 10);
    if (seconds > 0) {
      setCountdown(seconds);
      handleApiCall('countdown', { seconds });
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg">
      <button onClick={handleStart} className="p-2 bg-green-600 text-white rounded hover:bg-green-500">
        <MdPlayArrow className="w-6 h-6" />
      </button>
      <button onClick={handleStop} className="p-2 bg-red-600 text-white rounded hover:bg-red-500">
        <MdStop className="w-6 h-6" />
      </button>
      <button onClick={handleSetCountdown} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-500 flex items-center gap-1">
        <MdTimer className="w-6 h-6" />
        <span>Countdown</span>
      </button>
    </div>
  );
};
