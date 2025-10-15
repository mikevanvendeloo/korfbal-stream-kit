import { z } from 'zod';

export const SponsorTypeEnum = z.enum(['premium', 'goud', 'zilver', 'brons']);

export const SponsorInputSchema = z.object({
  name: z.string().min(1),
  type: SponsorTypeEnum,
  websiteUrl: z.string().url(),
  logoUrl: z.string().optional(),
});

export const SponsorUpdateSchema = SponsorInputSchema.partial();

export const SponsorQuerySchema = z.object({
  type: SponsorTypeEnum.optional(),
  page: z
    .preprocess((v) => (typeof v === 'string' ? parseInt(v, 10) : v), z.number().int().min(1))
    .default(1),
  limit: z
    .preprocess((v) => (typeof v === 'string' ? parseInt(v, 10) : v), z.number().int().min(1).max(100))
    .default(25),
});

export type SponsorInput = z.infer<typeof SponsorInputSchema>;
export type SponsorUpdate = z.infer<typeof SponsorUpdateSchema>;
export type SponsorQuery = z.infer<typeof SponsorQuerySchema>;

export function makeLogoUrl(name: string): string {
  const slug = name.trim().replace(/\s+/g, '-');
  return `${slug}.png`;
}
