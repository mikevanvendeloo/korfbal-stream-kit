export type Sponsor = {
  id: number;
  name: string;
  type: 'premium' | 'goud' | 'zilver' | 'brons';
  logoUrl: string;
  websiteUrl: string;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export async function fetchSponsors(params: { type?: Sponsor['type']; page?: number; limit?: number } = {}): Promise<Paginated<Sponsor>> {
  const url = new URL('/api/sponsors', API_BASE || window.location.origin);
  if (params.type) url.searchParams.set('type', params.type);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  const res = await fetch(url.toString());
  console.log('fetchSponsors', res);
  if (!res.ok) {
    throw new Error(`Failed to load sponsors: ${res.status}`);
  }
  return res.json();
}
