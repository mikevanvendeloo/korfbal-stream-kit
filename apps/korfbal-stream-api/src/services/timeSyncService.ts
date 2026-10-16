import {emitToOrganization} from './socket';
import {requireOrganizationId} from './organizationContext';
import {logger} from '../utils/logger';

type ClockMode = 'stopped' | 'counting_up' | 'counting_down';

interface TimeState {
  mode: ClockMode;
  serverStartTime: number;
  initialDuration: number;
  venueClock: string; // bv. "25:00"
}

// One clock per organization (D6), for the organization in the context
const timeStates = new Map<number, TimeState>();

function timeState(): TimeState {
  const organizationId = requireOrganizationId('The production clock');
  let state = timeStates.get(organizationId);
  if (!state) {
    state = {mode: 'stopped', serverStartTime: 0, initialDuration: 0, venueClock: '00:00'};
    timeStates.set(organizationId, state);
  }
  return state;
}

function broadcastTimeState() {
  const state = timeState();
  emitToOrganization('time_state_update', {...state});
  logger.info(`📢 Broadcasted time state: ${state.mode}, Venue: ${state.venueClock}`);
}

export const timeSyncService = {
  start: () => {
    const state = timeState();
    if (state.mode === 'counting_up') return;
    logger.info('⏰ Production clock STARTED');
    state.mode = 'counting_up';
    state.serverStartTime = Date.now();
    state.initialDuration = 0;
    broadcastTimeState();
  },

  setCountdown: (seconds: number) => {
    const state = timeState();
    logger.info(`⏰ Countdown set to ${seconds} seconds`);
    state.mode = 'counting_down';
    state.serverStartTime = Date.now();
    state.initialDuration = seconds;
    broadcastTimeState();
  },

  stop: () => {
    const state = timeState();
    if (state.mode === 'stopped') return;
    logger.info('⏰ Production clock STOPPED');
    state.mode = 'stopped';
    broadcastTimeState();
  },

  updateVenueClock: (newTime: string) => {
    const state = timeState();
    if (state.venueClock === newTime) return;
    state.venueClock = newTime;
    // Update de serverStartTime bij een venue clock update, zodat lokale interpolatie
    // op de client synchroon loopt met de laatst ontvangen tijd van de server.
    state.serverStartTime = Date.now();
    // We sturen de *volledige* state mee, zodat clients altijd alles hebben.
    broadcastTimeState();
  },

  getState: (): TimeState => ({...timeState()}),

  initializeClient: (socket: { emit: (event: string, ...args: unknown[]) => unknown }) => {
    socket.emit('time_state_update', {...timeState()});
  },
};
