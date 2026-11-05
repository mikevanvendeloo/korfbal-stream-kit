import {useEffect} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {getSharedSocket} from '../lib/socket';
import {fetchVenueBridgeStatus, VENUE_BRIDGE_STATUS_EVENT, type VenueBridgeStatus} from '../lib/venueBridge';

export const VENUE_BRIDGE_STATUS_KEY = ['venue-bridge', 'status'];

/**
 * The venue-bridge's status: the route once, then `venue_bridge_status` pushes it. `pollMs` also repeats the
 * route (the card shows ages, which the socket does not push).
 */
export function useVenueBridgeStatus(pollMs: number | false = false) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = getSharedSocket();
    const onStatus = (status: VenueBridgeStatus) => queryClient.setQueryData(VENUE_BRIDGE_STATUS_KEY, status);
    // A reconnect may have missed a change: ask again
    const refresh = () => void queryClient.invalidateQueries({queryKey: VENUE_BRIDGE_STATUS_KEY});
    socket.on(VENUE_BRIDGE_STATUS_EVENT, onStatus);
    socket.on('connect', refresh);
    return () => {
      socket.off(VENUE_BRIDGE_STATUS_EVENT, onStatus);
      socket.off('connect', refresh);
    };
  }, [queryClient]);
  return useQuery({queryKey: VENUE_BRIDGE_STATUS_KEY, queryFn: fetchVenueBridgeStatus, refetchInterval: pollMs});
}
