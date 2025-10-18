import { z } from 'zod';

export const GenderEnum = z.enum(['male', 'female']);

export const PersonInputSchema = z.object({
  name: z.string().min(1).max(200),
  gender: GenderEnum,
});

export const PersonUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  gender: GenderEnum.optional(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  gender: GenderEnum.optional(),
  q: z.string().optional(),
});

export const CapabilityInputSchema = z.object({
  capabilityId: z.coerce.number().int().positive(),
});

export const AssignmentCreateSchema = z.object({
  capabilityId: z.coerce.number().int().positive(),
  personId: z.coerce.number().int().positive(),
});

export const AssignmentUpdateSchema = z.object({
  capabilityId: z.coerce.number().int().positive().optional(),
  personId: z.coerce.number().int().positive().optional(),
});
