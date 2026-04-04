import {useEffect, useRef, useState} from 'react';
import {io, Socket} from 'socket.io-client';

import {getSocketUrl} from "../lib/api";

const API_URL = getSocketUrl();

type ClockMode = 'stopped' | 'counting_up' | 'counting_down';

interface ClockState {
  mode: ClockMode;
  serverStartTime: number;
  initialDuration: number;
}

interface DisplayTime {
  minutes: string;
  seconds: string;
  isNegative: boolean;
}

function formatTime(totalSeconds: number): DisplayTime {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(absSeconds % 60).toString().padStart(2, '0');
  return { minutes, seconds, isNegative };
}

export const useTimeSync = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [displayTime, setDisplayTime] = useState<DisplayTime>({ minutes: '00', seconds: '00', isNegative: false });

  const clockStateRef = useRef<ClockState | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const socket: Socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    const updateDisplay = () => {
      if (!clockStateRef.current || clockStateRef.current.mode === 'stopped') {
        setDisplayTime({ minutes: '00', seconds: '00', isNegative: false });
        return;
      }

      const state = clockStateRef.current;
      const elapsedTimeMs = Date.now() - state.serverStartTime;
      const elapsedTimeSec = elapsedTimeMs / 1000;

      if (state.mode === 'counting_up') {
        setDisplayTime(formatTime(elapsedTimeSec));
      } else if (state.mode === 'counting_down') {
        const remainingTime = state.initialDuration - elapsedTimeSec;
        setDisplayTime(formatTime(remainingTime));
      }
    };

    socket.on('connect', () => {
      setIsConnected(true);
      setLastSyncTime(Date.now());
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err.message);
      setIsConnected(false);
    });

    socket.on('time_state_update', (newState: ClockState) => {
      clockStateRef.current = newState;
      setLastSyncTime(Date.now());

      if (newState.mode === 'stopped') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        updateDisplay();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(updateDisplay, 100); // Update display every 100ms
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const timeSinceLastSync = lastSyncTime ? Math.round((Date.now() - lastSyncTime) / 1000) : null;

  return { isConnected, displayTime, timeSinceLastSync };
};
