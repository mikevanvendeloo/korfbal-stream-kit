import {z} from 'zod';

/**
 * A draaiboek file (JSON): the draaiboek template export (version 1 without, version 2 with hoofdstukken)
 * and the export of a production's draaiboek share this format, so either can be imported as the other.
 * Unknown fields are ignored.
 */

const id = z.union([z.string().max(100), z.number().int()]).transform(String);
const text = (max: number) => z.string().max(max);

export const DraaiboekFileItemSchema = z.object({
  id: id.optional(),
  cue: text(50).nullish().transform((v) => (v ?? '').trim()),
  title: z.string().trim().min(1, 'Elk item heeft een titel').max(500),
  note: text(5000).nullish(),
  color: text(50).nullish(),
  durationSec: z.coerce.number().int().min(0).max(24 * 3600),
  orderIndex: z.coerce.number().int().optional(),
  isInVenue: z.boolean().optional(),
  isInLivestream: z.boolean().optional(),
  isTimeAnchor: z.boolean().optional(),
  /** An empty value (older template files) counts as none */
  anchorType: z.preprocess((v) => (v === '' ? null : v), z.enum(['MATCH_START', 'LIVESTREAM_START']).nullish()),
  autoAdvance: z.boolean().optional(),
  parentId: id.nullish(),
  chapter: text(100).nullish(),
  positions: z.array(text(100)).max(100).optional(),
  /** Production draaiboek only: the planned start in seconds from the kickoff (informative; times are recomputed) */
  startOffsetSec: z.number().int().nullish(),
});

export const DraaiboekFileSchema = z.object({
  version: z.coerce.number().int().min(1).max(2, 'Alleen versie 1 en 2 worden ondersteund').optional(),
  name: text(200).optional(),
  chapters: z.array(z.object({name: text(100), positions: z.array(text(100)).max(100).optional()})).max(200).optional(),
  items: z.array(DraaiboekFileItemSchema).max(1000, 'Te veel items (maximaal 1000)'),
});

export type DraaiboekFile = z.infer<typeof DraaiboekFileSchema>;
export type DraaiboekFileItem = z.infer<typeof DraaiboekFileItemSchema>;
