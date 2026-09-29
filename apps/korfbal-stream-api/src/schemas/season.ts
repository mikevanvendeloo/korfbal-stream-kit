import {z} from 'zod';
import {parseSeasonName, SeasonIdParamSchema, SeasonIdSchema} from '../services/season';

export {SeasonIdParamSchema, SeasonIdSchema};

/** "YYYY/YYYY+1" season name, parsed to its start year. */
export const SeasonNameSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    try {
      return parseSeasonName(value);
    } catch (err) {
      ctx.addIssue({code: z.ZodIssueCode.custom, message: (err as Error).message});
      return z.NEVER;
    }
  });

export const CreateSeasonSchema = z.object({
  name: SeasonNameSchema,
  activate: z.boolean().optional().default(false),
});

export const SetActiveSeasonSchema = z.object({
  seasonId: SeasonIdSchema,
});

export type CreateSeasonInput = z.infer<typeof CreateSeasonSchema>;
