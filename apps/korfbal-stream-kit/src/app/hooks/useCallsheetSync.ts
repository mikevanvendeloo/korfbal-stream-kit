import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface ClockState {
  productionTime: number;
  scoreboardTime: number;
}

interface LiveProductionState {
  productionId: number | null;
  activeEventId: string | null;
  clocks: ClockState;
  isClockRunning: boolean;
}

const SOCKET_URL = 'http://localhost:3333'; // Your API server URL

export const useCallsheetSync = () => {
  const [state, setState] = useState<LiveProductionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to production server.');
      setIsLoading(false);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from production server.');
      setError('Connection lost. Reconnecting...');
    });

    socket.on('connect_error', (err) => {
      console.error('Connection Error:', err);
      setError('Failed to connect to the production server.');
      setIsLoading(false);
    });

    socket.on('callsheet_state_update', (newState: LiveProductionState) => {
      setState(newState);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  return { state, isLoading, error };
};
