import { useQuery } from '@tanstack/react-query';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3333';
const url = (p: string) => new URL(p, API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3333')).toString();

async function extractError(res: Response): Promise<string> {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body: any = await res.json().catch(() => ({}));
      if (body && (body.error || body.message)) return String(body.error || body.message);
    } else {
      const text = await res.text();
      if (text) return text;
    }
  } catch {}
  return `Request failed (${res.status})`;
}

export type Position = { id: number; name: string };

export function usePositionsCatalog() {
  return useQuery({
    queryKey: ['positions-catalog'],
    queryFn: async (): Promise<Position[]> => {
      const res = await fetch(url('/api/production/positions'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}
