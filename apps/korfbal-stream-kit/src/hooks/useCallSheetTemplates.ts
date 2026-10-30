import {useCallback, useState} from 'react';
import {useQueryClient} from "@tanstack/react-query";
import {createUrl} from "../lib/api";


export interface CallSheetTemplate {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

export interface CallSheetTemplateItem {
  id: string;
  templateId: number;
  /** Cue code (e.g. for vMix), copied to the production's callsheet item */
  cue: string;
  title: string;
  note: string | null;
  durationSec: number;
  orderIndex: number;
  isInVenue: boolean;
  isInLivestream: boolean;
  isTimeAnchor: boolean;
  anchorType: string | null;
  autoAdvance: boolean;
  parentId: string | null;
  /** The item's hoofdstuk (openspec/changes/chapters) */
  chapterId: string | null;
  /** Planned start in seconds from the kickoff (API, parallel-lanes D2); null without an anchor */
  startOffsetSec?: number | null;
  positions: { positionId: number; position: { name: string } }[];
}

/** A hoofdstuk of a template, with its standard positions in order */
export interface CallSheetTemplateChapter {
  id: string;
  name: string;
  orderIndex: number;
  positions: { positionId: number; orderIndex: number; position: { id: number; name: string } }[];
  /** Minimale duur in seconds (null = as long as its items) */
  minDurationSec?: number | null;
  /** Start and end in seconds from the kickoff (null without timed items), and how far the items run past the minimum */
  startOffsetSec?: number | null;
  endOffsetSec?: number | null;
  overrunSec?: number;
}

export interface FullCallSheetTemplate extends CallSheetTemplate {
  items: CallSheetTemplateItem[];
  chapters: CallSheetTemplateChapter[];
  /** Placed by the hoofdstuk migration (from the old segments) and not yet checked: Beheer asks to check the hoofdstukken */
  chaptersAutoPlaced: boolean;
}

export function useCallSheetTemplates() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl('/api/callsheets/templates'));
      if (!res.ok) throw new Error('Failed to fetch templates');
      return await res.json() as CallSheetTemplate[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplate = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/${id}`));
      if (!res.ok) throw new Error('Failed to fetch template details');
      return await res.json() as FullCallSheetTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl('/api/callsheets/templates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return await res.json() as CallSheetTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/${id}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (id: number, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      return await res.json() as CallSheetTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTemplateItem = useCallback(async (templateId: number, data: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/${templateId}/items`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add item');
      return await res.json() as CallSheetTemplateItem;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTemplateItem = useCallback(async (itemId: string, data: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/items/${itemId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update item');
      return await res.json() as CallSheetTemplateItem;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplateItem = useCallback(async (itemId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/items/${itemId}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reorderTemplateItems = useCallback(async (templateId: number, itemIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/${templateId}/reorder`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });
      if (!res.ok) throw new Error('Failed to reorder items');
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const applyTemplate = useCallback(async (templateId: number, productionId: number, options?: { replace?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(createUrl(`/api/callsheets/templates/${templateId}/apply/${productionId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      if (!res.ok) throw new Error('Failed to apply template');

      const result = await res.json();

      // Invalidate relevant queries after successful application
      qc.invalidateQueries({ queryKey: ['production', productionId] });

      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const importTemplate = useCallback(async (name: string, file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('file', file);

      const res = await fetch(createUrl('/api/callsheets/templates/import'), {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Importeren mislukt');
      return await res.json() as CallSheetTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const importTemplateJson = useCallback(async (name: string, file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('file', file);

      const res = await fetch(createUrl('/api/callsheets/templates/import-json'), {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Importeren mislukt');
      return await res.json() as CallSheetTemplate;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchTemplates,
    fetchTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplateItem,
    updateTemplateItem,
    deleteTemplateItem,
    reorderTemplateItems,
    applyTemplate,
    importTemplate,
    importTemplateJson,
  };
}
