import fs from 'node:fs';
import path from 'node:path';
import {getAssetsRoot} from './config';
import {isValidOrganizationSlug} from '../middleware/organizationContext';
import {prisma} from './prisma';
import {getOrganizationSlug, requireOrganizationId} from './organizationContext';

/**
 * Where logos live. The database stores only a file name; the directory follows from the owning
 * organization's slug (readable on disk, and the same on every system, unlike an id):
 * - sponsor logo: `Sponsor.logoUrl = "ruitenheer.png"` → `<assets>/sponsors/<slug>/ruitenheer.png`,
 *   served at `/uploads/sponsors/<slug>/ruitenheer.png`;
 * - organization logo: `Organization.logoUrl = "<slug>.png"` → `<assets>/organizations/<slug>.png`
 *   (only the extension of the stored name counts; the base is always the current slug).
 * A slug rename moves the files (renameOrganizationLogoFiles), so a slug is only reused after it was
 * renamed away, and the new organization then starts with an empty directory. Every path or URL of a
 * logo is built here.
 */
export const SPONSOR_LOGO_DIR = 'sponsors';
export const ORGANIZATION_LOGO_DIR = 'organizations';

type OrganizationRef = {slug: string};

/** A stored logo file name: no directory, no `..`, an image extension. saveImage writes `[a-z0-9-]` names; older ones may have capitals, `_` or dots. */
const LOGO_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*\.(png|jpe?g|gif|webp)$/i;

export function isLogoFileName(value: string): boolean {
  return value.length <= 200 && LOGO_FILE_NAME.test(value);
}

function slugOf(organization: OrganizationRef): string {
  // Slugs match ORGANIZATION_SLUG_PATTERN ([a-z0-9-]): never a separator or `..`
  if (!isValidOrganizationSlug(organization.slug)) throw new Error(`Invalid organization slug: ${organization.slug}`);
  return organization.slug;
}

/** `<assets>/sponsors/<slug>` */
export function sponsorLogoDir(organization: OrganizationRef, root = getAssetsRoot()): string {
  return path.join(root, SPONSOR_LOGO_DIR, slugOf(organization));
}

/** `sponsors/<slug>/<file>` below the assets root, or null without a (valid) file name. */
export function sponsorLogoRelPath(organization: OrganizationRef, file: string | null | undefined): string | null {
  const name = file?.trim();
  if (!name || !isLogoFileName(name)) return null;
  return `${SPONSOR_LOGO_DIR}/${slugOf(organization)}/${name}`;
}

/** URL path of an asset below the assets root (served under /uploads), each part encoded. */
export function assetSrc(relPath: string | null): string | null {
  return relPath ? `/uploads/${relPath.split('/').map(encodeURIComponent).join('/')}` : null;
}

/** `/uploads/sponsors/<slug>/<file>`, ready for an <img>, or null. */
export function sponsorLogoSrc(organization: OrganizationRef, file: string | null | undefined): string | null {
  return assetSrc(sponsorLogoRelPath(organization, file));
}

/** A sponsor as the API shows it: `logoUrl` (the stored file name) plus `logoSrc` (the URL to show it). */
export function withLogoSrc<T extends {logoUrl: string | null}>(organization: OrganizationRef, sponsor: T): T & {logoSrc: string | null} {
  return {...sponsor, logoSrc: sponsorLogoSrc(organization, sponsor.logoUrl)};
}

/** The image extension of a stored organization logo name (`.png`), or null. */
function organizationLogoExtension(logoUrl: string | null | undefined): string | null {
  const name = logoUrl?.trim();
  if (!name) return null;
  const ext = path.extname(path.basename(name)).toLowerCase();
  return /^\.(png|jpe?g|gif|webp)$/.test(ext) ? ext : null;
}

/** The file name to store for an organization logo: `<slug><ext>`. */
export function organizationLogoFileName(organization: OrganizationRef, extension: string): string {
  return `${slugOf(organization)}${extension}`;
}

/** `organizations/<slug>.<ext>` below the assets root, or null without a logo. */
export function organizationLogoRelPath(organization: OrganizationRef & {logoUrl: string | null}): string | null {
  const ext = organizationLogoExtension(organization.logoUrl);
  return ext ? `${ORGANIZATION_LOGO_DIR}/${organizationLogoFileName(organization, ext)}` : null;
}

export class SponsorLogoError extends Error {
  readonly status = 400;
  constructor() {
    super('Ongeldig logo: upload het logo bij de sponsor');
    this.name = 'SponsorLogoError';
  }
}

/** A value from a backup made between organizations and the slug directories: `<organizationId>/<file>`. */
const ID_PREFIXED_LOGO = /^\d+\/([^/]+)$/;

/**
 * The logoUrl (a file name) to store for a value a client sent. A logo is never derived from the name;
 * it is set by an upload. Absent or empty keeps `current` (null for a new sponsor), null removes it,
 * and the current value itself is kept. Anything else must be a file name that exists in the
 * organization's own directory, otherwise SponsorLogoError (or, with `lenient`, `current`: for bulk
 * imports). A file name can never point into another organization's directory: the directory comes
 * from the slug.
 *
 * `fromBackup` (backup restore) accepts any valid file name, also when the file isn't there yet (the
 * images come with the image download), and takes the file name of an older `<id>/<file>` value.
 */
export function resolveClientLogoUrl(
  value: string | null | undefined,
  organization: OrganizationRef,
  current: string | null,
  {lenient = false, fromBackup = false}: {lenient?: boolean; fromBackup?: boolean} = {},
): string | null {
  if (value === null) return null;
  let logoUrl = typeof value === 'string' ? value.trim() : '';
  if (!logoUrl || logoUrl === current) return current;
  if (fromBackup) logoUrl = ID_PREFIXED_LOGO.exec(logoUrl)?.[1] ?? logoUrl;
  if (isLogoFileName(logoUrl)) {
    if (fromBackup) return logoUrl;
    const file = path.join(sponsorLogoDir(organization), logoUrl);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return logoUrl;
  }
  if (lenient) return current;
  throw new SponsorLogoError();
}

/**
 * The slug of the organization in the context: from the request's (cached, at most a few seconds old,
 * cleared on a rename) organization lookup, else read from the database.
 */
export async function currentOrganizationRef({fresh = false}: {fresh?: boolean} = {}): Promise<OrganizationRef> {
  // Writes (an upload) always read it fresh: never a file into the directory of a slug just renamed away
  const slug = fresh ? undefined : getOrganizationSlug();
  if (slug) return {slug};
  const organization = await prisma.organization.findUnique({where: {id: requireOrganizationId()}, select: {slug: true}});
  if (!organization) throw new Error('Organization of the context not found');
  return organization;
}
