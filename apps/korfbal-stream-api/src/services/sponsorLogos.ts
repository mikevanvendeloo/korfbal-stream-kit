import path from 'node:path';
import {getAssetsRoot} from './config';

/**
 * Sponsor logos of an organization live in <assets>/sponsors/<organizationId>/ and are stored as
 * `<organizationId>/<file>` (served at /uploads/sponsors/<logoUrl>). The directory is keyed on the id,
 * not the slug: a slug can be renamed and then taken by another organization. Logos from before
 * organizations keep their plain file name (legacy, the shared directory); nothing new is written there.
 */
export function sponsorLogoDir(organizationId: number): string {
  return path.join(getAssetsRoot(), 'sponsors', String(organizationId));
}

export function sponsorLogoUrl(organizationId: number, fileName: string): string {
  return `${organizationId}/${fileName}`;
}

/** File names saveImage writes: `[a-z0-9-]` plus an image extension. */
const LOGO_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(png|jpg|gif|webp)$/;

/** Whether `logoUrl` points at a file in the organization's own logo directory. */
export function isOwnSponsorLogoUrl(logoUrl: string, organizationId: number): boolean {
  const parts = logoUrl.split('/');
  return parts.length === 2 && parts[0] === String(organizationId) && LOGO_FILE.test(parts[1]);
}

/** A logo from before organizations: a plain file name in the shared directory (read-only now). */
const LEGACY_LOGO_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*\.(png|jpe?g|gif|webp)$/i;

export function isLegacySponsorLogoUrl(logoUrl: string): boolean {
  return LEGACY_LOGO_FILE.test(logoUrl);
}

export class SponsorLogoError extends Error {
  readonly status = 400;
  constructor() {
    super('Ongeldig logo: upload het logo bij de sponsor');
    this.name = 'SponsorLogoError';
  }
}

/**
 * The logoUrl to store for a value a client sent. A logo is never derived from the name; it is set by
 * an upload. Absent or empty keeps `current` (null for a new sponsor), null removes it, the current
 * value itself is kept (also a legacy one), and anything else must be in the organization's own
 * directory, otherwise SponsorLogoError (or, with `lenient`, `current`: for bulk imports).
 *
 * `allowLegacy` (backup restore only) also accepts a legacy plain file name, so a backup from before
 * organizations (D11: the 2025 backup) keeps its logos. That file is only displayed: uploads never
 * write to the shared directory, so it can't be overwritten through another organization.
 */
export function resolveClientLogoUrl(
  value: string | null | undefined,
  organizationId: number,
  current: string | null,
  {lenient = false, allowLegacy = false}: {lenient?: boolean; allowLegacy?: boolean} = {},
): string | null {
  if (value === null) return null;
  const logoUrl = typeof value === 'string' ? value.trim() : '';
  if (!logoUrl || logoUrl === current) return current;
  if (isOwnSponsorLogoUrl(logoUrl, organizationId)) return logoUrl;
  if (allowLegacy && isLegacySponsorLogoUrl(logoUrl)) return logoUrl;
  if (lenient) return current;
  throw new SponsorLogoError();
}
