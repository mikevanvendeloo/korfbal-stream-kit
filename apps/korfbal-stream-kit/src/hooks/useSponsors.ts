import { useQuery } from '@tanstack/react-query';
import { fetchSponsors, Sponsor } from '../lib/api';

export function useSponsors(params: { type?: Sponsor['type']; page?: number; limit?: number } = {}) {
  const { type, page = 1, limit = 50 } = params;
  return useQuery({
    queryKey: ['sponsors', { type, page, limit }],
    queryFn: () => fetchSponsors({ type, page, limit }),
    staleTime: 60_000,
  });
}
