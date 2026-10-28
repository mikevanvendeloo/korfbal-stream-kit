import {z} from 'zod';

/** Hoofdstukken of a draaiboek (openspec/changes/chapters D4). */

const ChapterName = z.string().trim().min(1, 'Naam is verplicht').max(100);

export const ChapterCreateSchema = z.object({name: ChapterName});

/** A template hoofdstuk: its name and its standard positions in order (replaced as a whole). */
export const TemplateChapterUpdateSchema = z.object({
  name: ChapterName.optional(),
  positionIds: z.array(z.number().int().positive()).max(100).optional(),
});

export const ProductionChapterUpdateSchema = z.object({name: ChapterName});

/** The whole order of a draaiboek: every hoofdstuk with its items, in show order. */
export const TemplateStructureSchema = z.object({
  chapters: z.array(z.object({id: z.string().min(1), itemIds: z.array(z.string().min(1)).max(1000)})).min(1).max(200),
});

export const ProductionStructureSchema = z.object({
  chapters: z.array(z.object({id: z.number().int().positive(), itemIds: z.array(z.string().min(1)).max(1000)})).min(1).max(200),
});
