import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

// This now represents a subset of the full MatchSchedule model
const ManualMatchSchema = z.object({
  id: z.number(),
  date: z.string(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  description: z.string().optional().nullable(),
  refereeName: z.string().optional().nullable(),
});

export type ManualMatch = z.infer<typeof ManualMatchSchema>;

const ManualMatchInputSchema = ManualMatchSchema.omit({ id: true });
export type ManualMatchInput = z.infer<typeof ManualMatchInputSchema>;

async function fetchManualMatches(): Promise<ManualMatch[]> {
  const res = await fetch('/api/manual-matches');
  if (!res.ok) throw new Error('Failed to fetch manual matches');
  return res.json();
}

async function createManualMatch(input: ManualMatchInput): Promise<ManualMatch> {
  const res = await fetch('/api/manual-matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create manual match');
  return res.json();
}

async function updateManualMatch(match: ManualMatch): Promise<ManualMatch> {
  const { id, ...input } = match;
  const res = await fetch(`/api/manual-matches/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update manual match');
  return res.json();
}

async function deleteManualMatch(id: number): Promise<void> {
  const res = await fetch(`/api/manual-matches/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete manual match');
}

export function useManualMatches() {
  return useQuery({
    queryKey: ['manual-matches'],
    queryFn: fetchManualMatches,
  });
}

export function useCreateManualMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createManualMatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-matches'] });
      qc.invalidateQueries({ queryKey: ['production-matches'] }); // Also refetch production matches
    },
  });
}

export function useUpdateManualMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateManualMatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-matches'] });
      qc.invalidateQueries({ queryKey: ['production-matches'] });
    },
  });
}

export function useDeleteManualMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteManualMatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-matches'] });
      qc.invalidateQueries({ queryKey: ['production-matches'] });
    },
  });
}
