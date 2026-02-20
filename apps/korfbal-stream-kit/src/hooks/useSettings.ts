import {useQuery} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';

export function useBackendVersion() {
  return useQuery({
    queryKey: ['backend-version'],
    queryFn: async (): Promise<{ version: string }> => {
      const res = await fetch(createUrl('/api/settings/version'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}
