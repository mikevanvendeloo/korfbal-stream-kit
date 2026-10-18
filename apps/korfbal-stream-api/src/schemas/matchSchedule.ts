import {z} from 'zod';
import {parseDay} from '../utils/dayDate';

/** Default import range: counted by the source from the current week. 30 weeks from mid-October reaches the end of the indoor season. */
export const DEFAULT_IMPORT_RANGE = '30-weeks';
/** `date=indoor`: from the indoor competition start date of the active season (Season.indoorStartDate). */
export const INDOOR_IMPORT_DATE = 'indoor';

const RANGE = /^(\d{1,2})-weeks?$/i;

export const IMPORT_DATE_FORMAT_MESSAGE = 'Ongeldige datum: gebruik DD-MM-JJJJ (bijvoorbeeld 08-02-2026) of een aantal weken (bijvoorbeeld 30-weeks)';

/**
 * The import date, normalized: an ISO day `YYYY-MM-DD` (the provider converts it to its own format),
 * a range `N-weeks` (only weeks: the source answers days and months with a server error), or `indoor`.
 * Accepts DD-MM-YYYY and YYYY-MM-DD.
 */
export const MatchImportDateSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.toLowerCase() === INDOOR_IMPORT_DATE) return INDOOR_IMPORT_DATE;
    const range = RANGE.exec(value);
    if (range) {
      const weeks = Number(range[1]);
      if (weeks >= 1) return `${weeks}-weeks`;
    }
    const day = parseDay(value);
    if (day.ok) return day.iso;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: day.reason === 'impossible' ? `Datum ${value} bestaat niet` : IMPORT_DATE_FORMAT_MESSAGE,
    });
    return z.NEVER;
  });

// Query for POST /api/match/matches/schedule/import. Both values are passed on to the match schedule
// provider, so only accept single, simple strings (a repeated query param arrives as an array and is rejected).
export const MatchScheduleImportQuerySchema = z.object({
  date: z.union([z.string(), z.undefined()]).transform((v) => v ?? DEFAULT_IMPORT_RANGE).pipe(MatchImportDateSchema),
  // Forwarded as-is when present, including an empty value (upstream: no location filter)
  location: z
    .string()
    .trim()
    .regex(/^[A-Za-z_]*$/, 'location must contain only letters')
    .optional(),
});

export type MatchScheduleImportQuery = z.infer<typeof MatchScheduleImportQuerySchema>;
