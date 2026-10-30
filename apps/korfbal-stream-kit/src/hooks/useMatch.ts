import {fetchMatchClock, fetchScoreboard, fetchShotclock} from '../lib/api';
import {usePolledDevice} from './usePolledDevice';

export {DEVICE_FAILURE_THRESHOLD} from './usePolledDevice';
export type {DeviceStatus, PolledDevice} from './usePolledDevice';

// The API answers 502 when the device doesn't respond; an empty list is no usable answer either.
const hasItems = (items: unknown[]) => Array.isArray(items) && items.length > 0;

/** Score from the scoreboard device. */
export function useScoreboard(pollMs = 1000) {
  return usePolledDevice(fetchScoreboard, pollMs, hasItems);
}

/** Shot clock: a separate device. */
export function useShotclock(pollMs = 500) {
  return usePolledDevice(fetchShotclock, pollMs, hasItems);
}

/** Match clock (zaalklok): read from the scoreboard device. */
export function useMatchClock(pollMs = 1000) {
  return usePolledDevice(fetchMatchClock, pollMs, hasItems);
}
