import {z} from 'zod';

// Query for POST /api/match/matches/schedule/import. Both values are passed on to
// the match schedule provider, so only accept single, simple strings (a repeated
// query param arrives as an array and is rejected).
export const MatchScheduleImportQuerySchema = z.object({
  // An ISO date (2025-11-01) or a relative range such as '20-weeks'
  date: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{1,3}-[a-z]+)$/i, 'date must be YYYY-MM-DD or a range like 20-weeks')
    .default('20-weeks'),
  // Forwarded as-is when present, including an empty value (upstream: no location filter)
  location: z
    .string()
    .trim()
    .regex(/^[A-Za-z_]*$/, 'location must contain only letters')
    .optional(),
});

export type MatchScheduleImportQuery = z.infer<typeof MatchScheduleImportQuerySchema>;
