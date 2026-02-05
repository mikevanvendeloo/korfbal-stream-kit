import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from "../lib/api";

export type TitleSourceType = 'COMMENTARY' | 'PRESENTATION' | 'PRESENTATION_AND_ANALIST' | 'TEAM_PLAYER' | 'TEAM_COACH' | 'FREE_TEXT';
export type TeamSide = 'HOME' | 'AWAY' | 'NONE';

export type TitlePart = {
  sourceType: TitleSourceType;
  teamSide?: TeamSide;
  limit?: number | null;
  filters?: any;
  // For FREE_TEXT only
  customFunction?: string | null;
  customName?: string | null;
};

export type TitleDefinition = {
  id: number;
  productionId: number | null;
  name: string;
  order: number;
  enabled: boolean;
  parts: TitlePart[];
};

export type VmixTitleItem = { functionName: string; name: string };

// -------- Resolver (preview) --------
export function useVmixTitles(productionId: number) {
  return useQuery({
    queryKey: ['vmix', 'production', productionId, 'titles'],
    enabled: !!productionId,
    queryFn: async (): Promise<VmixTitleItem[]> => {
      const res = await fetch(createUrl(`/api/vmix/production/${productionId}/titles`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

// -------- Production title definitions --------
export function useProductionTitles(productionId: number) {
  return useQuery({
    queryKey: ['production', productionId, 'titles'],
    enabled: !!productionId,
    queryFn: async (): Promise<TitleDefinition[]> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/titles`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateProductionTitle(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; enabled?: boolean; order?: number; parts: TitlePart[] }): Promise<TitleDefinition> => {
      const sanitized = sanitizeDefinitionInput(input);
      const res = await fetch(createUrl(`/api/production/${productionId}/titles`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'titles'] });
      qc.invalidateQueries({ queryKey: ['vmix', 'production', productionId, 'titles'] });
    },
  });
}

export function useUpdateProductionTitle(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; name?: string; enabled?: boolean; parts?: TitlePart[] }): Promise<TitleDefinition> => {
      const sanitized = input.parts ? { ...input, parts: input.parts.map(sanitizePart) } : input;
      const res = await fetch(createUrl(`/api/production/${productionId}/titles/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'titles'] });
      qc.invalidateQueries({ queryKey: ['vmix', 'production', productionId, 'titles'] });
    },
  });
}

export function useDeleteProductionTitle(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (titleId: number) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/titles/${titleId}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'titles'] });
      qc.invalidateQueries({ queryKey: ['vmix', 'production', productionId, 'titles'] });
    },
  });
}

export function useReorderProductionTitles(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(createUrl(`/api/production/${productionId}/titles:reorder`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'titles'] });
      qc.invalidateQueries({ queryKey: ['vmix', 'production', productionId, 'titles'] });
    },
  });
}

export function useApplyDefaultTitles(productionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(createUrl(`/api/admin/vmix/production/${productionId}/titles/use-default`), { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production', productionId, 'titles'] });
      qc.invalidateQueries({ queryKey: ['vmix', 'production', productionId, 'titles'] });
    },
  });
}

// -------- Admin template hooks --------
export function useTitleTemplates() {
  return useQuery({
    queryKey: ['admin', 'vmix', 'title-templates'],
    queryFn: async (): Promise<TitleDefinition[]> => {
      const res = await fetch(createUrl(`/api/admin/vmix/title-templates`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useCreateTitleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; enabled?: boolean; order?: number; parts: TitlePart[] }): Promise<TitleDefinition> => {
      const sanitized = sanitizeDefinitionInput(input);
      const res = await fetch(createUrl(`/api/admin/vmix/title-templates`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'vmix', 'title-templates'] }),
  });
}

export function useUpdateTitleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; name?: string; enabled?: boolean; parts?: TitlePart[] }): Promise<TitleDefinition> => {
      const sanitized = input.parts ? { ...input, parts: input.parts.map(sanitizePart) } : input;
      const res = await fetch(createUrl(`/api/admin/vmix/title-templates/${input.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'vmix', 'title-templates'] }),
  });
}

export function useDeleteTitleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/admin/vmix/title-templates/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'vmix', 'title-templates'] }),
  });
}

export function useReorderTitleTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(createUrl(`/api/admin/vmix/title-templates:reorder`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'vmix', 'title-templates'] }),
  });
}

// ---------- Helpers ----------
function sanitizePart(p: TitlePart): TitlePart {
  const base: TitlePart = {
    sourceType: p.sourceType,
    teamSide: (p.teamSide as any) || 'NONE',
    limit: typeof p.limit === 'number' && Number.isFinite(p.limit) ? p.limit : undefined,
    filters: p.filters,
  };
  if (p.sourceType === 'FREE_TEXT') {
    const customFunction = (p.customFunction || '').trim();
    const customName = (p.customName || '').trim();
    return {
      ...base,
      customFunction,
      customName,
    };
  } else {
    // Remove any stray custom fields to satisfy backend zod (z.never())
    return base;
  }
}

function sanitizeDefinitionInput<T extends { name: string; enabled?: boolean; order?: number; parts: TitlePart[] }>(input: T): T {
  const parts = Array.isArray(input.parts) ? input.parts.map(sanitizePart) : [];
  return { ...(input as any), parts } as T;
}
