import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {extractError} from "../lib/api";

export type Gender = 'male' | 'female';
export type Person = { id: number; name: string; gender: Gender; createdAt: string };
export type Paginated<T> = { items: T[]; page: number; limit: number; total: number; pages: number };

export function usePersons(params: { q?: string; gender?: Gender; page?: number; limit?: number } = {}) {
  const qk = ['persons', params] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<Paginated<Person>> => {
      const u = new URL('/api/production/persons', window.location.origin);
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
      const res = await fetch('/api/production/persons', {
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
      const res = await fetch(`/api/production/persons/${input.id}`, {
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
      const res = await fetch(`/api/production/persons/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export type SkillCatalog = { id: number; code: string; nameMale: string; nameFemale: string };

export function useSkillsCatalog() {
  const qk = ['skills-catalog'] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<SkillCatalog[]> => {
      const res = await fetch('/api/production/skills');
      if (!res.ok) throw new Error(await extractError(res));
      const data = await res.json();
      // API returns paginated; support both paginated and array (if proxy used)
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export type Skill = { personId: number; skillId: number; skill: SkillCatalog };

export function useSkills(personId: number) {
  const qk = ['persons', personId, 'skills'] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<Skill[]> => {
      const res = await fetch(`/api/production/persons/${personId}/skills`);
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    enabled: !!personId,
  });
}

export function useAddSkill(personId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillId: number) => {
      const res = await fetch(`/api/production/persons/${personId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons', personId, 'skills'] }),
  });
}

export function useRemoveSkill(personId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillId: number) => {
      const res = await fetch(`/api/production/persons/${personId}/skills/${skillId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons', personId, 'skills'] }),
  });
}

// Bulk add multiple skills to a person in one call site for improved readability
export function useAddSkillsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { personId: number; skillIds: number[] }) => {
      const { personId, skillIds } = input;
      const errors: string[] = [];
      for (const skillId of skillIds) {
        const res = await fetch(`/api/production/persons/${personId}/skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId }),
        });
        if (!res.ok) {
          errors.push(await extractError(res));
        }
      }
      // Invalidate the person's skills afterwards
      await qc.invalidateQueries({ queryKey: ['persons', input.personId, 'skills'] });
      if (errors.length > 0) {
        const msg = errors.join('; ');
        throw new Error(msg || 'Failed to add one or more skills');
      }
      return { ok: true };
    },
  });
}
