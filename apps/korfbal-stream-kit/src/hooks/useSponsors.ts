import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSponsor,
  deleteSponsor,
  downloadAllSponsorLogos,
  fetchSponsors,
  Sponsor,
  SponsorInput,
  updateSponsor,
  uploadSponsorLogo
} from '../lib/api';

export function useSponsors(params: { type?: Sponsor['type'] | Sponsor['type'][]; page?: number; limit?: number } = {}) {
  const { type, page = 1, limit = 50 } = params;
  return useQuery({
    queryKey: ['sponsors', { type, page, limit }],
    queryFn: () => fetchSponsors({ type, page, limit }),
    staleTime: 60_000,
  });
}

export function useCreateSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SponsorInput) => createSponsor(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

export function useUpdateSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; input: Partial<SponsorInput> }) => updateSponsor(args.id, args.input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

export function useDeleteSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSponsor(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

export function useUploadSponsorLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; file: File }) => uploadSponsorLogo(args.id, args.file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });
}

export function useDownloadAllSponsorLogos() {
  return useMutation({
    mutationFn: () => downloadAllSponsorLogos(),
  });
}
