import {useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';
import {useParams} from 'react-router-dom';
import {EventStatus, TriggerSource} from '@prisma/client';
import {createUrl, getSocketUrl} from "../lib/api";

const API_URL = getSocketUrl();

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
  const absSeconds = Math.abs(Math.round(totalSeconds));
  const minutes = Math.floor(absSeconds / 60).toString().padStart(2, '0');
  const seconds = (absSeconds % 60).toString().padStart(2, '0');
  return { minutes, seconds, isNegative, rawSeconds: totalSeconds };
}

export function formatSystemTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Berekent de verwachte starttijden voor alle events in een productie.
 * Houdt rekening met plannedStartTime, actualStartTime (als verschuiving) en parent/child relaties.
 */
export function calculateEventTimes(allItems: ProductionEvent[]): (ProductionEvent & { calculatedTime: Date | null })[] {
  if (!allItems.length) return [];

  // 1. Zoek naar een ankerpunt voor de tijdverschuiving (Start wedstrijd)
  const anchorEvent = allItems.find(it => it.isTimeAnchor || it.title === 'Start wedstrijd');
  let timeShiftMs = 0;

  if (anchorEvent && anchorEvent.actualStartTime && anchorEvent.plannedStartTime) {
    const plannedAnchorDate = new Date(anchorEvent.plannedStartTime);
    const actualAnchorDate = new Date(anchorEvent.actualStartTime);
    timeShiftMs = actualAnchorDate.getTime() - plannedAnchorDate.getTime();
  }

  // 2. Bereken voor elk item de verwachte tijd
  return allItems.map(item => {
    let calculatedStartTime: Date | null = null;

    // A. Als het een gelinkt item is, neem de tijd van de parent
    if (item.parentId) {
      const parent = allItems.find(it => it.id === item.parentId);
      if (parent && parent.plannedStartTime) {
        calculatedStartTime = new Date(parent.plannedStartTime);
      }
    }

    // B. Als we nog geen tijd hebben, gebruik de eigen geplande starttijd
    if (!calculatedStartTime && item.plannedStartTime) {
      calculatedStartTime = new Date(item.plannedStartTime);
    }

    // C. Fallback: als er echt geen geplande tijd is, gebruik de order als relatieve offset vanaf vandaag 00:00
    if (!calculatedStartTime) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      calculatedStartTime = new Date(today.getTime() + (item.order * 1000));
    }

    // D. Pas de tijdverschuiving van het ankerpunt toe (als dat er is)
    if (calculatedStartTime && timeShiftMs !== 0) {
      calculatedStartTime = new Date(calculatedStartTime.getTime() + timeShiftMs);
    }

    return {
      ...item,
      calculatedTime: calculatedStartTime,
    };
  });
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
  const [autoAdvanceEventId, setAutoAdvanceEventId] = useState<string | null>(null);

  const timeStateRef = useRef<TimeState | null>(null);
  const eventStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeEventRef = useRef<ProductionEvent | null>(null);

  useEffect(() => {
    const fetchData = async (isInitial = false) => {
      if (!productionId) return;

      try {
        if (isInitial) {
          setIsLoading(true);
        }
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

        // Haal huidige klok status op
        const clockResponse = await fetch(createUrl(`/api/production/${productionId}/clocks`));
        if (clockResponse.ok) {
          const clockData = await clockResponse.json();
          if (clockData.clocks) {
              const displayVenue = formatTime(clockData.clocks.scoreboardTime);
              const venueClockStr = `${displayVenue.minutes}:${displayVenue.seconds}`;

              // Alleen setten als het niet 00:00 is of als we nog niks hebben
              if (clockData.clocks.scoreboardTime > 0 || !venueClock) {
                setVenueClock(venueClockStr);
              }

              if (!timeStateRef.current) {
                timeStateRef.current = {
                  mode: clockData.isClockRunning ? 'counting_up' : 'stopped',
                  serverStartTime: Date.now() - (clockData.clocks.productionTime * 1000),
                  initialDuration: clockData.clocks.scoreboardTime,
                  venueClock: venueClockStr
                };
              }
          }
        }

      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!productionId) return;

    fetchData(true);

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    const updateClocks = () => {
      setSystemTime(formatSystemTime(new Date()));

      if (timeStateRef.current) {
        const state = timeStateRef.current;

        if (state.mode !== 'stopped') {
          const elapsedMs = Date.now() - state.serverStartTime;
          const elapsedSec = elapsedMs / 1000;

          if (state.mode === 'counting_up') {
            setProductionClock(formatTime(elapsedSec));
          } else if (state.mode === 'counting_down') {
            setProductionClock(formatTime(state.initialDuration - elapsedSec));
          }

          // Lokale interpolatie voor de zaalklok (venueClock)
          // Scorebord data komt binnen als "MM:SS" (bijv. "15:34")
          const venueParts = state.venueClock.split(':');
          if (venueParts.length === 2) {
            const venueMins = parseInt(venueParts[0]);
            const venueSecs = parseInt(venueParts[1]);
            const totalVenueSecs = venueMins * 60 + venueSecs;

            // We interpoleren vanaf de laatst ontvangen venue clock tijd.
            // Omdat we weten dat de serverStartTime is bijgewerkt bij de laatste venue clock update,
            // kunnen we berekenen hoeveel tijd er sindsdien is verstreken.
            const elapsedSinceLastVenueSync = (Date.now() - state.serverStartTime) / 1000;

            // Korfbal klokken tellen vrijwel altijd af.
            const interpolatedVenueSecs = Math.max(0, totalVenueSecs - elapsedSinceLastVenueSync);
            const displayVenue = formatTime(interpolatedVenueSecs);
            setVenueClock(`${displayVenue.minutes}:${displayVenue.seconds}`);
          } else {
            setVenueClock(state.venueClock);
          }
        } else {
          setProductionClock({ minutes: '00', seconds: '00', isNegative: false, rawSeconds: 0 });
          setVenueClock(state.venueClock);
        }
      }

      if (eventStartTimeRef.current) {
        const eventElapsedMs = Date.now() - eventStartTimeRef.current;
        const eventElapsedSec = eventElapsedMs / 1000;

        // Bereken resterende tijd voor actief event
        const active = activeEventRef.current;
        if (active && active.durationSec !== undefined && active.durationSec !== null) {
          const remaining = formatTime(active.durationSec - eventElapsedSec);
          setActiveEventRemainingTime(remaining);
          // Gebruik de rawSeconds van het formatTime resultaat om elapsedTime consistent te houden
          setActiveEventElapsedTime(active.durationSec - remaining.rawSeconds);
        } else {
          setActiveEventElapsedTime(eventElapsedSec);
          setActiveEventRemainingTime(null);
        }
      } else {
        setActiveEventElapsedTime(0);
        setActiveEventRemainingTime(null);
      }
    };

    socket.on('production_events_update_needed', () => {
      fetchData();
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err.message);
      setIsConnected(false);
    });
    socket.on('heartbeat', () => setLastSyncTime(Date.now()));

    socket.on('callsheet_state_update', (state: any) => {
      if (state.clocks) {
        // Update venue clock from global state if no specific time_state_update was received yet
        // or as a fallback. Format seconds to MM:SS
        const displayVenue = formatTime(state.clocks.scoreboardTime);
        const venueClockStr = `${displayVenue.minutes}:${displayVenue.seconds}`;

        // Alleen overschrijven als we een zinvolle tijd hebben of als de huidige 00:00 is
        if (state.clocks.scoreboardTime > 0 || venueClock === '00:00' || !venueClock) {
            setVenueClock(venueClockStr);
        }

        // Update timeStateRef if it's currently null or if it has a 0 duration and we get a positive one
        if (!timeStateRef.current || (timeStateRef.current.initialDuration === 0 && state.clocks.scoreboardTime > 0)) {
          timeStateRef.current = {
            mode: state.isClockRunning ? 'counting_up' : 'stopped',
            serverStartTime: Date.now() - (state.clocks.productionTime * 1000),
            initialDuration: state.clocks.scoreboardTime,
            venueClock: venueClockStr
          };
        }
      }
    });

    socket.on('time_state_update', (newState: TimeState) => {
      timeStateRef.current = newState;
      setLastSyncTime(Date.now());
      // Triggers immediate update
      if (newState.venueClock) {
          setVenueClock(newState.venueClock);
      }
    });

    socket.on('active_event_update', (event: ProductionEvent) => {
      setActiveEvent(event);
      activeEventRef.current = event;
      setAutoAdvanceEventId(null); // Reset auto-advance indicator
      if (event.actualStartTime) {
        eventStartTimeRef.current = new Date(event.actualStartTime).getTime();
      } else {
        eventStartTimeRef.current = Date.now();
      }
      setActiveEventElapsedTime(0);
      setActiveEventRemainingTime(null);
    });

    socket.on('auto_advance_scheduled', (data: { eventId: string, delayMs: number }) => {
      setAutoAdvanceEventId(data.eventId);
    });

    socket.on('production_events_update', (data: { items: ProductionEvent[] }) => {
      setAllItems(data.items);
    });

    socket.on('production_events_update_needed', () => {
      fetchData();
    });

    intervalRef.current = setInterval(updateClocks, 100);

    return () => {
      if (socket) {
        socket.disconnect();
      }
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
    autoAdvanceEventId,
  };
};
