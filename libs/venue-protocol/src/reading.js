import { z } from 'zod';
export const VENUE_DEVICES = ['score', 'clock', 'shotclock'];
export const VENUE_READING_ERRORS = ['unreachable', 'invalid', 'not-configured'];
/** A device answers a few bytes ("["15","34"]"); more is not a scoreboard. */
export const MAX_READING_BYTES = 4096;
export const MAX_READING_ITEMS = 20;
export const VenueReadingSchema = z.object({
    device: z.enum(VENUE_DEVICES),
    ok: z.boolean(),
    /** The device's array, unchanged */
    data: z.array(z.unknown()).max(MAX_READING_ITEMS),
    error: z.enum(VENUE_READING_ERRORS).optional(),
    /** ISO time of the read */
    readAt: z.string().datetime(),
}).refine((r) => JSON.stringify(r.data).length <= MAX_READING_BYTES, { message: 'Reading too large', path: ['data'] });
