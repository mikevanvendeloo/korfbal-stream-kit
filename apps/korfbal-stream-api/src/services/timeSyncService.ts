import {getIO} from './socket';
import {logger} from '../utils/logger';

type ClockMode = 'stopped' | 'counting_up' | 'counting_down';

interface TimeState {
  mode: ClockMode;
  serverStartTime: number;
  initialDuration: number;
  venueClock: string; // bv. "25:00"
}

const timeState: TimeState = {
  mode: 'stopped',
  serverStartTime: 0,
  initialDuration: 0,
  venueClock: '00:00',
};

function broadcastTimeState() {
  const io = getIO();
  io.emit('time_state_update', timeState);
  logger.info(`📢 Broadcasted time state: ${timeState.mode}, Venue: ${timeState.venueClock}`);
}

export const timeSyncService = {
  start: () => {
    if (timeState.mode === 'counting_up') return;
    logger.info('⏰ Production clock STARTED');
    timeState.mode = 'counting_up';
    timeState.serverStartTime = Date.now();
    timeState.initialDuration = 0;
    broadcastTimeState();
  },

  setCountdown: (seconds: number) => {
    logger.info(`⏰ Countdown set to ${seconds} seconds`);
    timeState.mode = 'counting_down';
    timeState.serverStartTime = Date.now();
    timeState.initialDuration = seconds;
    broadcastTimeState();
  },

  stop: () => {
    if (timeState.mode === 'stopped') return;
    logger.info('⏰ Production clock STOPPED');
    timeState.mode = 'stopped';
    broadcastTimeState();
  },

  updateVenueClock: (newTime: string) => {
    if (timeState.venueClock === newTime) return;
    timeState.venueClock = newTime;
    // Update de serverStartTime bij een venue clock update, zodat lokale interpolatie
    // op de client synchroon loopt met de laatst ontvangen tijd van de server.
    timeState.serverStartTime = Date.now();
    // We sturen de *volledige* state mee, zodat clients altijd alles hebben.
    // Dit voorkomt race conditions.
    broadcastTimeState();
  },

  getState: () => {
    return timeState;
  },

  initializeClient: (socket: any) => {
    socket.emit('time_state_update', timeState);
  },
};
