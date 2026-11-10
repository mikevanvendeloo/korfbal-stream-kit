import {z} from 'zod';
import {VmixInstancesConfigSchema} from './vmixInstances';

const relativePath = (v: string) => !/^([a-z]:|[\\/])/i.test(v) && !v.split(/[\\/]+/).includes('..');

/** http(s) address of the "Tweede Scherm klassiek" page, or a relative .html path inside the share */
export const StatsPageUrlSchema = z.string().trim().max(500).refine(
  (v) => /^https?:\/\/[^\s/]+/i.test(v) || (relativePath(v) && !v.includes(':') && /\.html?$/i.test(v)),
  'pageUrl must be an http(s) URL or a relative .html path',
);

/** Path of WEDSTRIJDEN.mdb inside the share; may contain {team} */
export const StatsMdbPathSchema = z.string().trim().max(300).refine(
  (v) => relativePath(v) && /\.(mdb|accdb)$/i.test(v),
  'mdbPath must be a relative .mdb/.accdb path',
);

/** An http(s) address only: file:, ftp:, data: and the like are refused (the bridge fetches these addresses) */
export const HttpUrlSchema = z.string().trim().url().max(500).refine((v) => /^https?:\/\//i.test(v), 'The address must start with http:// or https://');

const deviceUrl = HttpUrlSchema.nullable();

export const VenueConfigSchema = z.object({
  scoreboard: z.object({url: deviceUrl}),
  shotclock: z.object({url: deviceUrl}),
  stats: z.object({
    pageUrl: StatsPageUrlSchema.nullable(),
    mdbPath: StatsMdbPathSchema.nullable(),
    mdbEnabled: z.boolean(),
    shareHost: z.string().trim().max(200).nullable(),
    keepCopy: z.boolean(),
  }),
  vmix: VmixInstancesConfigSchema,
  /** Hash of the content, so a bridge and the API can tell whether they agree */
  version: z.string().min(1).max(100),
});

export type VenueConfig = z.infer<typeof VenueConfigSchema>;
export type VenueStatsConfig = VenueConfig['stats'];
