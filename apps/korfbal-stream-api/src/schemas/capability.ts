import { z } from 'zod';

export const CapabilityInputSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase().regex(/^[A-Z0-9_]+$/),
  functionName: z.string().min(1).max(200),
  nameMale: z.string().min(1).max(200),
  nameFemale: z.string().min(1).max(200),
  vMixTitle: z.coerce.boolean().default(false),
});

export const CapabilityUpdateSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase().regex(/^[A-Z0-9_]+$/).optional(),
  functionName: z.string().min(1).max(200).optional(),
  nameMale: z.string().min(1).max(200).optional(),
  nameFemale: z.string().min(1).max(200).optional(),
  vMixTitle: z.coerce.boolean().optional(),
});

export const CapabilityQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
});
