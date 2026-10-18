import {z} from 'zod';
import {parseSeasonName, SeasonIdParamSchema, SeasonIdSchema} from '../services/season';
import {parseDay} from '../utils/dayDate';

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

/** A day as DD-MM-YYYY or YYYY-MM-DD, normalized to ISO `YYYY-MM-DD`. */
const DaySchema = z.string().trim().transform((value, ctx) => {
  const day = parseDay(value);
  if (day.ok) return day.iso;
  ctx.addIssue({code: z.ZodIssueCode.custom, message: day.reason === 'impossible' ? `Datum ${value} bestaat niet` : 'Gebruik DD-MM-JJJJ, bijvoorbeeld 07-11-2026'});
  return z.NEVER;
});

/** PUT /api/seasons/:id: the indoor competition start date; null clears it. */
export const UpdateSeasonSchema = z.object({
  indoorStartDate: DaySchema.nullable(),
}).strict();

export type CreateSeasonInput = z.infer<typeof CreateSeasonSchema>;
