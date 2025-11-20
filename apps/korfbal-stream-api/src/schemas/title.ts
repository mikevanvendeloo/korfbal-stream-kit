import {z} from 'zod';

export const TitleSourceTypeEnum = z.enum([
  'COMMENTARY',
  'PRESENTATION',
  'PRESENTATION_AND_ANALIST',
  'TEAM_PLAYER',
  'TEAM_COACH',
  'FREE_TEXT',
]);

export const TeamSideEnum = z.enum(['HOME', 'AWAY', 'NONE']);

// Conditional schema per sourceType
export const TitlePartSchema = z.discriminatedUnion('sourceType', [
  // Commentary: no teamSide (or NONE) and no custom*
  z.object({
    sourceType: z.literal('COMMENTARY'),
    teamSide: TeamSideEnum.default('NONE'),
    limit: z.number().int().positive().optional(),
    filters: z.any().optional(),
    customFunction: z.never().optional() as any,
    customName: z.never().optional() as any,
  }), z.object({
    sourceType: z.literal('PRESENTATION'),
    teamSide: TeamSideEnum.default('NONE'),
    limit: z.number().int().positive().optional(),
    filters: z.any().optional(),
    customFunction: z.never().optional() as any,
    customName: z.never().optional() as any,
  }),
  // Presentation & analyst: no teamSide (or NONE) and no custom*
  z.object({
    sourceType: z.literal('PRESENTATION_AND_ANALIST'),
    teamSide: TeamSideEnum.default('NONE'),
    limit: z.number().int().positive().optional(),
    filters: z.any().optional(),
    customFunction: z.never().optional() as any,
    customName: z.never().optional() as any,
  }),
  // Team players: teamSide required; custom* forbidden
  z.object({
    sourceType: z.literal('TEAM_PLAYER'),
    teamSide: TeamSideEnum, // HOME|AWAY|NONE, but UI/route should pass HOME/AWAY for team types
    limit: z.number().int().positive().optional(),
    filters: z.any().optional(),
    customFunction: z.never().optional() as any,
    customName: z.never().optional() as any,
  }),
  // Team coaches: teamSide required; custom* forbidden
  z.object({
    sourceType: z.literal('TEAM_COACH'),
    teamSide: TeamSideEnum,
    limit: z.number().int().positive().optional(),
    filters: z.any().optional(),
    customFunction: z.never().optional() as any,
    customName: z.never().optional() as any,
  }),
  // Free text: requires customFunction + customName; teamSide/limit irrelevant
  z.object({
    sourceType: z.literal('FREE_TEXT'),
    teamSide: TeamSideEnum.default('NONE').optional(),
    limit: z.number().int().positive().optional(),
    filters: z.any().optional(),
    customFunction: z.string().min(1),
    customName: z.string().min(1),
  }),
]);

export const CreateTitleDefinitionSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  parts: z.array(TitlePartSchema).min(1),
});

export const UpdateTitleDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  parts: z.array(TitlePartSchema).min(1).optional(),
});

export const ReorderTitleDefinitionsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});
