import { z } from 'zod';

export const SkillInputSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase().regex(/^[A-Z0-9_]+$/),
  name: z.string().min(1).max(200),
  nameMale: z.string().min(1).max(200),
  nameFemale: z.string().min(1).max(200),
});

export const SkillUpdateSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase().regex(/^[A-Z0-9_]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  nameMale: z.string().min(1).max(200).optional(),
  nameFemale: z.string().min(1).max(200).optional(),
});

export const SkillQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
});
