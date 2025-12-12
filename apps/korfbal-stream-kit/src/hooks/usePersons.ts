import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiUrl as url } from '../config/env';

export type Gender = 'male' | 'female';
export type Person = { id: number; name: string; gender: Gender; createdAt: string };
export type Paginated<T> = { items: T[]; page: number; limit: number; total: number; pages: number };

// centralized url helper is imported

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

export function usePersons(params: { q?: string; gender?: Gender; page?: number; limit?: number } = {}) {
  const qk = ['persons', params] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<Paginated<Person>> => {
      const u = new URL(url('/api/production/persons'));
      if (params.q) u.searchParams.set('q', params.q);
      if (params.gender) u.searchParams.set('gender', params.gender);
      if (params.page) u.searchParams.set('page', String(params.page));
      if (params.limit) u.searchParams.set('limit', String(params.limit));
      const res = await fetch(u.toString());
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; gender: Gender }): Promise<Person> => {
      const res = await fetch(url('/api/production/persons'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; name?: string; gender?: Gender }): Promise<Person> => {
      const res = await fetch(url(`/api/production/persons/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.name, gender: input.gender }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const res = await fetch(url(`/api/production/persons/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export type CapabilityCatalog = { id: number; code: string; nameMale: string; nameFemale: string; vMixTitle?: boolean };

export function useCapabilitiesCatalog() {
  const qk = ['capabilities-catalog'] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<CapabilityCatalog[]> => {
      const res = await fetch(url('/api/production/capabilities'));
      if (!res.ok) throw new Error(await extractError(res));
      const data = await res.json();
      // API returns paginated; support both paginated and array (if proxy used)
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export type Capability = { personId: number; capabilityId: number; capability: CapabilityCatalog };

export function useCapabilities(personId: number) {
  const qk = ['persons', personId, 'capabilities'] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<Capability[]> => {
      const res = await fetch(url(`/api/production/persons/${personId}/capabilities`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    enabled: !!personId,
  });
}

export function useAddCapability(personId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (capabilityId: number) => {
      const res = await fetch(url(`/api/production/persons/${personId}/capabilities`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityId }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons', personId, 'capabilities'] }),
  });
}

export function useRemoveCapability(personId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (capabilityId: number) => {
      const res = await fetch(url(`/api/production/persons/${personId}/capabilities/${capabilityId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons', personId, 'capabilities'] }),
  });
}

// Bulk add multiple capabilities to a person in one call site for improved readability
export function useAddCapabilitiesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; capabilityIds: number[] }) => {
      const { personId, capabilityIds } = input;
      const errors: string[] = [];
      for (const capabilityId of capabilityIds) {
        const res = await fetch(url(`/api/production/persons/${personId}/capabilities`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capabilityId }),
        });
        if (!res.ok) {
          errors.push(await extractError(res));
        }
      }
      // Invalidate the person's capabilities afterwards
      await qc.invalidateQueries({ queryKey: ['persons', input.personId, 'capabilities'] });
      if (errors.length > 0) {
        const msg = errors.join('; ');
        throw new Error(msg || 'Failed to add one or more capabilities');
      }
      return { ok: true };
    },
  });
}
