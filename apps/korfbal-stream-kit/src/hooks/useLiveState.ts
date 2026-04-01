import {useEffect, useRef, useState} from 'react';
import {io, Socket} from 'socket.io-client';
import {useParams} from 'react-router-dom';
import {EventStatus, TriggerSource} from '@prisma/client';
import {createUrl} from "../lib/api";

const API_URL = 'http://localhost:3333';

// --- Type definities ---
type ClockMode = 'stopped' | 'counting_up' | 'counting_down';

interface TimeState {
  mode: ClockMode;
  serverStartTime: number;
  initialDuration: number;
  venueClock: string;
}

export interface Position {
  id: number;
  name: string;
}

export interface ProductionEvent {
  id: string;
  productionId: number;
  order: number;
  title: string;
  note: string | null;
  durationSec: number | null;
  triggerSource: TriggerSource;
  vMixInputName: string | null;
  status: EventStatus;
  actualStartTime: Date | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  metadata: any;
  createdAt: Date;
  isInVenue: boolean;
  isInLivestream: boolean;
  autoAdvance: boolean;
  isTimeAnchor: boolean;
  anchorType: string | null;
  production: any;
  parentId?: string | null;
  parent?: ProductionEvent | null;
  linkedItems?: ProductionEvent[];
  positions: { position: Position }[];
}

interface DisplayTime {
  minutes: string;
  seconds: string;
  isNegative: boolean;
  rawSeconds: number;
}

// --- Helper Functies ---
export function formatTime(totalSeconds: number): DisplayTime {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(absSeconds % 60).toString().padStart(2, '0');
  return { minutes, seconds, isNegative, rawSeconds: totalSeconds };
}

export function formatSystemTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// --- De Hook ---
export const useLiveState = () => {
  const { productionId } = useParams<{ productionId: string }>();
  const [allItems, setAllItems] = useState<ProductionEvent[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]); // Nieuwe state voor alle posities
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<ProductionEvent | null>(null);
  const [productionClock, setProductionClock] = useState<DisplayTime>({ minutes: '00', seconds: '00', isNegative: false, rawSeconds: 0 });
  const [venueClock, setVenueClock] = useState('00:00');
  const [systemTime, setSystemTime] = useState(formatSystemTime(new Date()));
  const [activeEventElapsedTime, setActiveEventElapsedTime] = useState(0);
  const [activeEventRemainingTime, setActiveEventRemainingTime] = useState<DisplayTime | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const timeStateRef = useRef<TimeState | null>(null);
  const eventStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeEventRef = useRef<ProductionEvent | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!productionId) return;

      try {
        setIsLoading(true);
        // Haal alle events op
        const eventsResponse = await fetch(createUrl(`/api/production/${productionId}/events`));
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const items: ProductionEvent[] = eventsData.items;
          setAllItems(items);

          // Zet het initiële actieve event op basis van de status
          const active = items.find(item => item.status === 'ACTIVE');
          if (active) {
            setActiveEvent(active);
            activeEventRef.current = active;
            // We schatten de starttijd in op basis van actualStartTime als die er is
            if (active.actualStartTime) {
              eventStartTimeRef.current = new Date(active.actualStartTime).getTime();
            } else {
              eventStartTimeRef.current = Date.now();
            }
          }
        } else {
          console.error("Failed to fetch all items.");
        }

        // Haal alle unieke posities op
        const positionsResponse = await fetch(createUrl(`/api/production/${productionId}/events/positions`));
        if (positionsResponse.ok) {
          const positionsData: Position[] = await positionsResponse.json();
          setAllPositions(positionsData);
        } else {
          console.error("Failed to fetch all positions.");
        }

      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (productionId) {
      fetchData();
    }

    const socket: Socket = io(API_URL, { transports: ['websocket'] });

    const updateClocks = () => {
      setSystemTime(formatSystemTime(new Date()));

      if (timeStateRef.current) {
        const state = timeStateRef.current;
        setVenueClock(state.venueClock);

        if (state.mode !== 'stopped') {
          const elapsedMs = Date.now() - state.serverStartTime;
          const elapsedSec = elapsedMs / 1000;

          if (state.mode === 'counting_up') {
            setProductionClock(formatTime(elapsedSec));
          } else if (state.mode === 'counting_down') {
            setProductionClock(formatTime(state.initialDuration - elapsedSec));
          }
        } else {
          setProductionClock({ minutes: '00', seconds: '00', isNegative: false, rawSeconds: 0 });
        }
      }

      if (eventStartTimeRef.current) {
        const eventElapsedMs = Date.now() - eventStartTimeRef.current;
        const eventElapsedSec = eventElapsedMs / 1000;
        setActiveEventElapsedTime(eventElapsedSec);

        // Bereken resterende tijd voor actief event
        const active = activeEventRef.current;
        if (active && active.durationSec) {
          setActiveEventRemainingTime(formatTime(active.durationSec - eventElapsedSec));
        } else {
          setActiveEventRemainingTime(null);
        }
      } else {
        setActiveEventElapsedTime(0);
        setActiveEventRemainingTime(null);
      }
    };

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('heartbeat', () => setLastSyncTime(Date.now()));

    socket.on('time_state_update', (newState: TimeState) => {
      timeStateRef.current = newState;
      setLastSyncTime(Date.now());
    });

    socket.on('active_event_update', (event: ProductionEvent) => {
      setActiveEvent(event);
      activeEventRef.current = event;
      if (event.actualStartTime) {
        eventStartTimeRef.current = new Date(event.actualStartTime).getTime();
      } else {
        eventStartTimeRef.current = Date.now();
      }
      setActiveEventElapsedTime(0);
      setActiveEventRemainingTime(null);
    });

    socket.on('production_events_update', (data: { items: ProductionEvent[] }) => {
      setAllItems(data.items);
    });

    socket.on('production_events_update_needed', () => {
      fetchData();
    });

    intervalRef.current = setInterval(updateClocks, 100);

    return () => {
      socket.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [productionId]);

  const timeSinceLastSync = lastSyncTime ? Math.round((Date.now() - lastSyncTime) / 1000) : null;

  return {
    allItems,
    allPositions, // Geef alle posities mee
    isConnected,
    timeSinceLastSync,
    activeEvent,
    productionClock,
    venueClock,
    systemTime,
    activeEventElapsedTime,
    activeEventRemainingTime,
    isLoading,
  };
};
