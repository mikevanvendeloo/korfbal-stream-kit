import {ProductionEvent} from '@prisma/client';
import {getIO} from './socket';
import {prisma} from './prisma';
import {logger} from '../utils/logger';

interface ClockState {
  productionTime: number; // in seconds
  scoreboardTime: number; // in seconds
}

interface LiveProductionState {
  productionId: number | null;
  activeEventId: string | null;
  clocks: ClockState;
  isClockRunning: boolean;
}

// This is our in-memory "source of truth" for the live show.
const currentState: LiveProductionState = {
  productionId: null,
  activeEventId: null,
  clocks: {
    productionTime: 0,
    scoreboardTime: 0,
  },
  isClockRunning: false,
};

let clockInterval: NodeJS.Timeout | null = null;

function broadcastState() {
  const io = getIO();
  io.emit('callsheet_state_update', currentState);
}

export function startProductionClock(productionId: number) {
  if (currentState.isClockRunning) return;

  currentState.productionId = productionId;
  currentState.isClockRunning = true;

  if (clockInterval) clearInterval(clockInterval);

  clockInterval = setInterval(() => {
    currentState.clocks.productionTime++;
    broadcastState();
  }, 1000);

  logger.info(`Production clock started for production ID: ${productionId}`);
}

export function stopProductionClock() {
  if (!clockInterval) return;
  clearInterval(clockInterval);
  clockInterval = null;
  currentState.isClockRunning = false;
  logger.info('Production clock stopped.');
}

export function updateScoreboardClock(timeInSeconds: number) {
  currentState.clocks.scoreboardTime = timeInSeconds;
  broadcastState();
}

export async function setActiveEvent(eventId: string, productionId: number) {
  const event = await prisma.productionEvent.findUnique({ where: { id: eventId } });
  if (!event || event.productionId !== productionId) return;

  // Set previous active event to COMPLETED
  if (currentState.activeEventId) {
    await prisma.productionEvent.update({
      where: { id: currentState.activeEventId },
      data: { status: 'COMPLETED' },
    });
  }

  // Set the new event to ACTIVE
  const activeEvent = await prisma.productionEvent.update({
    where: { id: eventId },
    data: { status: 'ACTIVE', actualStartTime: new Date() },
  });

  currentState.activeEventId = activeEvent.id;
  if (!currentState.isClockRunning) {
    startProductionClock(productionId);
  }

  broadcastState();
  return activeEvent;
}

export async function getNextEvent(): Promise<ProductionEvent | null> {
    if (!currentState.productionId || !currentState.activeEventId) return null;

    const currentEvent = await prisma.productionEvent.findUnique({ where: { id: currentState.activeEventId }});
    if (!currentEvent) return null;

    return prisma.productionEvent.findFirst({
        where: {
            productionId: currentState.productionId,
            order: {
                gt: currentEvent.order,
            },
        },
        orderBy: {
            order: 'asc',
        },
    });
}

export function getActiveProductionId() {
  return currentState.productionId;
}

export function startProduction(productionId: number, firstEvent: ProductionEvent) {
  currentState.productionId = productionId;
  currentState.activeEventId = firstEvent.id;
  if (!currentState.isClockRunning) {
    startProductionClock(productionId);
  }
  // No need to await here, it's just updating status
  prisma.productionEvent.update({
    where: { id: firstEvent.id },
    data: { status: 'ACTIVE', actualStartTime: new Date() }
  }).catch(err => logger.error(`Error updating first event: ${err}`));

  broadcastState();
}

export function updateVenueClock(time: string) {
  // Parse time "MM:SS" to seconds
  const [minutes, seconds] = time.split(':').map(Number);
  if (!isNaN(minutes) && !isNaN(seconds)) {
    currentState.clocks.scoreboardTime = minutes * 60 + seconds;
    broadcastState();
  }
}
