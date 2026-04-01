import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';

export interface SegmentTemplateItem {
  id: number;
  templateId: number;
  naam: string;
  volgorde: number;
  duurInMinuten: number;
  isTimeAnchor: boolean;
}

export interface SegmentTemplate {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  items?: SegmentTemplateItem[];
}

export function useSegmentTemplates() {
  const queryClient = useQueryClient();

  const query = useQuery<SegmentTemplate[]>({
    queryKey: ['segment-templates'],
    queryFn: async (): Promise<SegmentTemplate[]> => {
      const res = await fetch(createUrl('/api/production/segment-templates'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });

  const useTemplate = (id: number) => useQuery<SegmentTemplate>({
    queryKey: ['segment-templates', id],
    queryFn: async (): Promise<SegmentTemplate> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/${id}`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    enabled: !!id,
  });

  const createTemplate = useMutation({
    mutationFn: async (name: string): Promise<SegmentTemplate> => {
      const res = await fetch(createUrl('/api/production/segment-templates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }): Promise<SegmentTemplate> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/${id}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
    },
  });

  const addItem = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: number; data: Partial<SegmentTemplateItem> }): Promise<SegmentTemplateItem> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/${templateId}/items`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
      queryClient.invalidateQueries({ queryKey: ['segment-templates', variables.templateId] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: Partial<SegmentTemplateItem> }): Promise<SegmentTemplateItem> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/items/${itemId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
      if (data?.templateId) {
        queryClient.invalidateQueries({ queryKey: ['segment-templates', data.templateId] });
      }
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: number): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/items/${itemId}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
    },
  });

  const applyTemplate = useMutation({
    mutationFn: async ({ templateId, productionId }: { templateId: number; productionId: number }): Promise<any> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/apply/${templateId}/to/${productionId}`), {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-segments'] });
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/${id}/set-default`), {
        method: 'PUT',
      });
      if (!res.ok) throw new Error(await extractError(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
    },
  });

  const createTemplateFromProduction = useMutation({
    mutationFn: async ({ productionId, name }: { productionId: number; name: string }): Promise<SegmentTemplate> => {
      const res = await fetch(createUrl(`/api/production/segment-templates/from-production/${productionId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segment-templates'] });
    },
  });

  return {
    templates: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    useTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addItem,
    updateItem,
    deleteItem,
    applyTemplate,
    setDefaultTemplate,
    createTemplateFromProduction,
  };
}
