import {z} from 'zod';
import {MAX_SLUG_LENGTH, ORGANIZATION_SLUG_PATTERN} from '../middleware/organizationContext';

export const OrganizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(MAX_SLUG_LENGTH)
  .regex(ORGANIZATION_SLUG_PATTERN, 'Alleen kleine letters, cijfers en streepjes');

export const OrganizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: OrganizationSlugSchema,
  clubId: z.number().int().positive().nullable().optional(),
}).strict();

export const OrganizationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: OrganizationSlugSchema.optional(),
  clubId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const MATCH_SOURCE_PROVIDERS = ['vrijwilligers'] as const;

/** apiToken: a string replaces the stored token, null removes it, absent keeps it. */
export const MatchSourceInputSchema = z.object({
  provider: z.enum(MATCH_SOURCE_PROVIDERS),
  baseUrl: z.string().trim().url().refine((url) => /^https?:\/\//i.test(url), 'Alleen http(s)-adressen'),
  apiToken: z.string().trim().min(1).max(2000).nullable().optional(),
  isEnabled: z.boolean().optional(),
}).strict();

export type OrganizationCreate = z.infer<typeof OrganizationCreateSchema>;
export type OrganizationUpdate = z.infer<typeof OrganizationUpdateSchema>;
export type MatchSourceInput = z.infer<typeof MatchSourceInputSchema>;
