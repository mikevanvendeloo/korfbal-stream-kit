import {useQuery} from '@tanstack/react-query';
import {fetchStatsConnection} from '../lib/statsApi';

const REFRESH_MS = 15_000;

/** The statistics connection test; `auto` also repeats it every 15 s. One query, shared by the page and its status lines. */
export function useStatsConnection(auto: boolean) {
  return useQuery({
    queryKey: ['stats', 'connection'],
    queryFn: fetchStatsConnection,
    refetchInterval: auto ? REFRESH_MS : false,
    enabled: auto,
  });
}
