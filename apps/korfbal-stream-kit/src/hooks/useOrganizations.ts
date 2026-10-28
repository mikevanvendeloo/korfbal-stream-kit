import {QueryClient, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError, matchImportError} from '../lib/api';
import {followRenamedOrganization} from '../lib/organization';

/** An organization as the API shows it (routes/organizations.ts → toOrganizationDto). */
export type Organization = {
  id: number;
  slug: string;
  name: string;
  /** Own uploaded logo, relative to /storage (organizations/<id>.<ext>) */
  logoUrl: string | null;
  clubId: number | null;
  isActive: boolean;
  createdAt: string;
  /** What to show: the own logo, else the linked club's (relative to /storage, or http) */
  displayLogoUrl: string | null;
  initials: string;
};

export type OrganizationInput = { name: string; slug: string; clubId: number | null };
export type OrganizationUpdate = Partial<OrganizationInput> & { isActive?: boolean };

export const organizationKeys = {
  all: ['organizations'] as const,
  active: ['organizations', 'active'] as const,
  everything: ['organizations', 'all'] as const,
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

/** Active organizations, for the start screen (public, no organization needed). */
export function useActiveOrganizations() {
  return useQuery({
    queryKey: organizationKeys.active,
    queryFn: async (): Promise<Organization[]> => json(await fetch(createUrl('/api/organizations'))),
    staleTime: 60_000,
  });
}

/** All organizations, also the inactive ones (Beheer → tandwiel → Organisaties). */
export function useAllOrganizations() {
  return useQuery({
    queryKey: organizationKeys.everything,
    queryFn: async (): Promise<Organization[]> => json(await fetch(createUrl('/api/organizations?all=true'))),
  });
}

function useInvalidateOrganizations() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({queryKey: organizationKeys.all});
}

export function useCreateOrganization() {
  const invalidate = useInvalidateOrganizations();
  return useMutation({
    mutationFn: async (input: OrganizationInput): Promise<Organization> =>
      json(await fetch(createUrl('/api/organizations'), {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input),
      })),
    onSuccess: invalidate,
  });
}

/**
 * Puts a saved organization in the cached lists straight away, so the lists and the chosen slug agree
 * before the refetch (the start screen would otherwise see the new slug in an old list, or the reverse).
 */
function storeOrganization(qc: QueryClient, saved: Organization): void {
  const replace = (list: Organization[] | undefined) => list?.map((o) => (o.id === saved.id ? saved : o));
  qc.setQueryData<Organization[]>(organizationKeys.everything, replace);
  qc.setQueryData<Organization[]>(organizationKeys.active, (list) => replace(list)?.filter((o) => o.isActive));
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  const invalidate = useInvalidateOrganizations();
  return useMutation({
    mutationFn: async ({id, ...input}: OrganizationUpdate & { id: number }): Promise<Organization> => {
      const lists = [organizationKeys.everything, organizationKeys.active].map((key) => qc.getQueryData<Organization[]>(key));
      const previousSlug = lists.flatMap((list) => list ?? []).find((o) => o.id === id)?.slug;
      const saved: Organization = await json(await fetch(createUrl(`/api/organizations/${id}`), {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input),
      }));
      // Right after the PUT, before any refetch or poll: the old slug answers 403 from now on
      storeOrganization(qc, saved);
      if (previousSlug) followRenamedOrganization(previousSlug, saved.slug);
      return saved;
    },
    onSuccess: invalidate,
  });
}

export function useUploadOrganizationLogo() {
  const invalidate = useInvalidateOrganizations();
  return useMutation({
    mutationFn: async ({id, file}: { id: number; file: File }): Promise<Organization> => {
      const form = new FormData();
      form.append('file', file, file.name);
      return json(await fetch(createUrl(`/api/organizations/${id}/logo`), {method: 'POST', body: form}));
    },
    onSuccess: invalidate,
  });
}

export function useDeleteOrganizationLogo() {
  const invalidate = useInvalidateOrganizations();
  return useMutation({
    mutationFn: async (id: number): Promise<Organization> =>
      json(await fetch(createUrl(`/api/organizations/${id}/logo`), {method: 'DELETE'})),
    onSuccess: invalidate,
  });
}

// -------- Match import of the chosen organization (routes/matchSource.ts) --------

export const MATCH_SOURCE_PROVIDERS = [{value: 'vrijwilligers', label: 'Sportclub Vrijwilligersmanagement'}] as const;
export type MatchSourceProvider = typeof MATCH_SOURCE_PROVIDERS[number]['value'];

/** The token is never sent back: only whether one is set. */
export type MatchSource = {
  provider: MatchSourceProvider;
  baseUrl: string;
  isEnabled: boolean;
  hasApiToken: boolean;
  /** false: nothing saved yet, these are the defaults */
  configured: boolean;
  updatedAt: string | null;
};

/** apiToken: a string replaces the stored token, null removes it, left out keeps it. */
export type MatchSourceInput = { provider: MatchSourceProvider; baseUrl: string; isEnabled?: boolean; apiToken?: string | null };

const matchSourceKey = ['match-source'] as const;

export function useMatchSource() {
  return useQuery({
    queryKey: matchSourceKey,
    queryFn: async (): Promise<MatchSource> => json(await fetch(createUrl('/api/match-source'))),
  });
}

export function useSaveMatchSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MatchSourceInput): Promise<MatchSource> =>
      json(await fetch(createUrl('/api/match-source'), {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input),
      })),
    onSuccess: (saved) => qc.setQueryData(matchSourceKey, saved),
  });
}

/**
 * Tests the stored settings by asking the source for the coming week: the number of matches, or a
 * MatchImportError with the category of the failure (never details of the other server).
 */
export function useTestMatchSource() {
  return useMutation({
    mutationFn: async (): Promise<{ ok: true; matches: number }> => {
      const res = await fetch(createUrl('/api/match-source/test'), {method: 'POST'});
      if (!res.ok) throw await matchImportError(res, 'Geen verbinding met de wedstrijdbron');
      return res.json();
    },
  });
}

// -------- API keys of the chosen organization (routes/apiKeys.ts) --------

export type ApiKey = {
  id: number;
  name: string;
  /** The start of the key, to recognise it by */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** Only the answer to creating a key holds the full key, once. */
export type CreatedApiKey = ApiKey & { key: string };

const apiKeysKey = ['organization', 'api-keys'] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeysKey,
    queryFn: async (): Promise<ApiKey[]> => json(await fetch(createUrl('/api/organization/api-keys'))),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<CreatedApiKey> =>
      json(await fetch(createUrl('/api/organization/api-keys'), {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name}),
      })),
    // Never cache the full key: the list only gets the public fields
    onSuccess: () => qc.invalidateQueries({queryKey: apiKeysKey}),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<ApiKey> =>
      json(await fetch(createUrl(`/api/organization/api-keys/${id}`), {method: 'DELETE'})),
    onSuccess: () => qc.invalidateQueries({queryKey: apiKeysKey}),
  });
}

// -------- Feed URLs for vMix (routes/vmix.ts → /api/vmix/endpoints) --------

export type VmixEndpoint = { name: string; url: string; description: string };
export type VmixEndpointsResponse = {
  hostIp: string;
  /** Stands in the URLs where the key goes (`key=<jouw-sleutel>`) */
  keyPlaceholder: string;
  endpoints: VmixEndpoint[];
};

export function useVmixEndpoints() {
  return useQuery({
    queryKey: ['vmix-endpoints'],
    queryFn: async (): Promise<VmixEndpointsResponse> => json(await fetch(createUrl('/api/vmix/endpoints'))),
  });
}

/** A feed URL with a real key in place of the placeholder. */
export function withApiKey(url: string, placeholder: string, key: string): string {
  return url.split(placeholder).join(encodeURIComponent(key));
}
