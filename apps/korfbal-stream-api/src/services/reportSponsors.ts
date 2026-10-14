import fs from 'node:fs';
import path from 'node:path';
import {getAssetsRoot} from './config';

type SponsorLike = { name: string; displayName?: string | null; logoUrl: string };

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The sponsor a report field refers to. The field holds a name (chosen from the list or typed),
 * so a typed name only gets a logo when it matches a sponsor's name or display name.
 */
export function findSponsorByName<T extends SponsorLike>(name: string | null | undefined, sponsors: T[]): T | undefined {
  if (!name?.trim()) return undefined;
  const wanted = normalize(name);
  return sponsors.find((s) => normalize(s.name) === wanted)
    ?? sponsors.find((s) => s.displayName && normalize(s.displayName) === wanted);
}

/** Path of a sponsor logo below the assets root (served under /uploads), or null without a logo. */
export function sponsorLogoPath(sponsor: SponsorLike | undefined): string | null {
  const file = sponsor?.logoUrl?.trim();
  return file ? `sponsors/${file}` : null;
}

/** The logo file on disk when PDFKit can draw it (PNG or JPEG), else null. */
export function sponsorLogoFile(logoPath: string | null): string | null {
  if (!logoPath || !/\.(png|jpe?g)$/i.test(logoPath)) return null;
  const root = getAssetsRoot();
  const full = path.resolve(root, logoPath);
  // logoUrl comes from the database, but never read outside the assets dir
  if (!full.startsWith(path.resolve(root) + path.sep)) return null;
  return fs.existsSync(full) ? full : null;
}
