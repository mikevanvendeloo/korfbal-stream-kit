import {z} from 'zod';

const ClubNameSchema = z.string().trim().min(1, 'Naam mag niet leeg zijn').max(100, 'Naam is te lang (max 100 tekens)');

// An HTML colour code, stored lowercase (#e30613); null or '' removes it
const ClubColorSchema = z.string().trim()
  .regex(/^(#[0-9A-Fa-f]{6})?$/, 'Kleur: een HTML-kleurcode zoals #e30613')
  .transform((s) => (s ? s.toLowerCase() : null))
  .nullable()
  .optional();

/** PUT /api/clubs/:slug: name, short name, abbreviation and colours; the slug never changes. */
export const UpdateClubSchema = z.object({
  name: ClubNameSchema.optional(),
  shortName: ClubNameSchema.optional(),
  // Logos and the LED screen: 1-5 letters/digits, stored uppercase
  abbreviation: z.string().trim()
    .regex(/^[A-Za-z0-9]{1,5}$/, 'Afkorting: 1 tot 5 letters of cijfers')
    .transform((s) => s.toUpperCase())
    .optional(),
  primaryColor: ClubColorSchema,
  secondaryColor: ClubColorSchema,
}).strict();
