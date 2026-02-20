import {z} from 'zod';

export const SponsorTypeEnum = z.enum(['premium', 'goud', 'zilver', 'brons']);

export const SponsorInputSchema = z.object({
  name: z.string().min(1),
  type: SponsorTypeEnum,
  websiteUrl: z.string().url(),
  logoUrl: z.string().optional(),
  displayName: z.string().optional(),
});

export const SponsorUpdateSchema = SponsorInputSchema.partial();

export const SponsorQuerySchema = z.object({
  type: z.union([SponsorTypeEnum, z.array(SponsorTypeEnum)]).optional(),
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

function slugifyBase(input: string, lowerCase = true): string {
  let s = String(input || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, ''); // strip diacritics
  if (lowerCase) s = s.toLowerCase();
  // Replace ampersand with Dutch 'en'
  s = s.replace(/&/g, '-en-');
  // Remove slashes
  s = s.replace(/[\\/]+/g, '');
  // Replace any run of non-alphanumeric with a single dash
  s = s.replace(/[^a-zA-Z0-9]+/g, '-');
  // Collapse multiple dashes and trim
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s;
}

export function normalizeLogoFilename(input: string): string {
  // Strip known extensions first
  const noExt = String(input || '').replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
  const base = slugifyBase(noExt, true);
  return `${base.toLowerCase()}.png`;
}

export function makeLogoUrl(name: string): string {
  // For derived filenames from Name, preserve casing as in tests (e.g., ACME-BV.png)
  const base = slugifyBase(name, false);
  return `${base.toLowerCase()}.png`;
}
