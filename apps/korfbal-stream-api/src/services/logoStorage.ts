import fs from 'node:fs';
import path from 'node:path';
import type {PrismaClient} from '@prisma/client';
import {getAssetsRoot} from './config';
import {prismaUnscoped} from './prisma';
import {isLogoFileName, ORGANIZATION_LOGO_DIR, SPONSOR_LOGO_DIR} from './sponsorLogos';
import {logger} from '../utils/logger';

/**
 * Moving logo files: with a slug rename, and once from the older layouts into the slug directories.
 * See services/sponsorLogos.ts for the layout itself.
 */

/** Extensions an organization logo may have on disk (saveImage writes the first four). */
const ORGANIZATION_LOGO_EXTENSIONS = ['.png', '.jpg', '.gif', '.webp', '.jpeg'];

export class LogoDirectoryConflictError extends Error {
  readonly status = 409;
  constructor(what: string) {
    super(`Er staan al bestanden voor deze slug (${what}): kies een andere slug`);
    this.name = 'LogoDirectoryConflictError';
  }
}

function lexists(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function renameBack(done: Array<[string, string]>): void {
  for (const [from, to] of [...done].reverse()) {
    try {
      fs.renameSync(to, from);
    } catch (err) {
      logger.error(`Could not move ${to} back to ${from}`, err as any);
    }
  }
}

// One rename at a time, so two renames can't both see a free target
let renameQueue: Promise<unknown> = Promise.resolve();

/**
 * Changes an organization's slug and moves its logo files with it: `sponsors/<old>` →
 * `sponsors/<new>` and `organizations/<old>.<ext>` → `organizations/<new>.<ext>`.
 *
 * Order: files first, then the database (`updateDatabase`, e.g. a Prisma update); when the database
 * update fails, the files are moved back. A rename can be undone exactly, a committed transaction only
 * with a second write that can fail too. When anything for the new slug is already on disk
 * (`sponsors/<new>` or `organizations/<new>.*`) nothing changes: LogoDirectoryConflictError (409), so a
 * renamed organization never takes over files that are already there.
 */
export function renameOrganizationLogoFiles<T>(
  oldSlug: string,
  newSlug: string,
  updateDatabase: () => Promise<T>,
  root = getAssetsRoot(),
): Promise<T> {
  const run = async (): Promise<T> => {
    if (oldSlug === newSlug) return updateDatabase();
    const moves: Array<[string, string]> = [];
    const sponsorsFrom = path.join(root, SPONSOR_LOGO_DIR, oldSlug);
    const sponsorsTo = path.join(root, SPONSOR_LOGO_DIR, newSlug);
    if (lexists(sponsorsTo)) throw new LogoDirectoryConflictError(`${SPONSOR_LOGO_DIR}/${newSlug}`);
    if (lexists(sponsorsFrom)) moves.push([sponsorsFrom, sponsorsTo]);
    for (const ext of ORGANIZATION_LOGO_EXTENSIONS) {
      const from = path.join(root, ORGANIZATION_LOGO_DIR, `${oldSlug}${ext}`);
      const to = path.join(root, ORGANIZATION_LOGO_DIR, `${newSlug}${ext}`);
      if (lexists(to)) throw new LogoDirectoryConflictError(`${ORGANIZATION_LOGO_DIR}/${newSlug}${ext}`);
      if (lexists(from)) moves.push([from, to]);
    }
    const done: Array<[string, string]> = [];
    try {
      for (const [from, to] of moves) {
        fs.renameSync(from, to);
        done.push([from, to]);
      }
    } catch (err) {
      renameBack(done);
      throw err;
    }
    try {
      const result = await updateDatabase();
      if (done.length) logger.info(`Logo files moved with the slug rename ${oldSlug} → ${newSlug}`, {moved: done.length});
      return result;
    } catch (err) {
      renameBack(done);
      throw err;
    }
  };
  const result = renameQueue.then(run, run);
  renameQueue = result.catch(() => undefined);
  return result;
}

// ---------------------------------------------------------------------------------------------------
// Startup: from the id directories and the shared legacy directory into the slug directories
// ---------------------------------------------------------------------------------------------------

export interface LogoStorageMigrationSummary {
  /** Files moved from `sponsors/<id>/` and `organizations/<id>.<ext>`. */
  movedFromIdPaths: number;
  /** Legacy `sponsors/<file>` files moved into the slug directory (only this organization used them). */
  legacyMoved: number;
  /** Legacy files copied (another organization's sponsor uses the same file). */
  legacyCopied: number;
  /** Target already there with the same content: the source was removed (move) or left (copy). */
  alreadyThere: number;
  /** Target already there with other content: nothing overwritten, both kept. */
  conflicts: number;
}

type MigrationDb = Pick<PrismaClient, 'organization' | 'sponsor'>;

function isRegularFile(p: string): boolean {
  try {
    return fs.lstatSync(p).isFile(); // lstat: a symlink is not followed or moved
  } catch {
    return false;
  }
}

function sameContent(a: string, b: string): boolean {
  const [sa, sb] = [fs.statSync(a), fs.statSync(b)];
  return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
}

type Outcome = 'done' | 'alreadyThere' | 'conflict';

function placeFile(from: string, to: string, mode: 'move' | 'copy'): Outcome {
  if (lexists(to)) {
    if (isRegularFile(to) && sameContent(from, to)) {
      if (mode === 'move') fs.unlinkSync(from);
      return 'alreadyThere';
    }
    logger.warn(`Logo ${to} already exists with other content: ${from} left where it is`);
    return 'conflict';
  }
  fs.mkdirSync(path.dirname(to), {recursive: true});
  if (mode === 'copy') {
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  } else {
    try {
      fs.renameSync(from, to);
    } catch (err: any) {
      if (err?.code !== 'EXDEV') throw err;
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      fs.unlinkSync(from);
    }
  }
  return 'done';
}

/** A value from before the SQL migration (`<id>/<file>`) or a plain file name: the file name. */
function logoFileName(logoUrl: string): string {
  return logoUrl.trim().replace(/^\d+\//, '');
}

/**
 * Idempotent; runs at startup (before serving) and after a sponsors restore. Per organization:
 * - `sponsors/<organizationId>/*` → `sponsors/<slug>/*` (the empty id directory is removed);
 * - legacy `sponsors/<file>` that this organization's sponsors use → `sponsors/<slug>/<file>`: moved,
 *   or copied when a sponsor of another organization uses the same file;
 * - `organizations/<organizationId>.<ext>` → `organizations/<slug>.<ext>`.
 * Never overwrites: a target with other content is logged and skipped. Symlinks are not followed.
 * An id directory is left alone when the id is also some organization's slug (ambiguous).
 */
export async function migrateLogoStorage(
  {db = prismaUnscoped as unknown as MigrationDb, assetsRoot = getAssetsRoot(), organizationIds}: {db?: MigrationDb; assetsRoot?: string; organizationIds?: number[]} = {},
): Promise<LogoStorageMigrationSummary> {
  const summary: LogoStorageMigrationSummary = {movedFromIdPaths: 0, legacyMoved: 0, legacyCopied: 0, alreadyThere: 0, conflicts: 0};
  const count = (outcome: Outcome, done: keyof LogoStorageMigrationSummary) => {
    if (outcome === 'done') summary[done]++;
    else if (outcome === 'alreadyThere') summary.alreadyThere++;
    else summary.conflicts++;
  };
  const organizations = await db.organization.findMany({select: {id: true, slug: true}});
  const slugs = new Set(organizations.map((o) => o.slug));
  const sponsors = await db.sponsor.findMany({where: {logoUrl: {not: null}}, select: {organizationId: true, logoUrl: true}});
  const usedBy = new Map<string, Set<number>>();
  for (const s of sponsors) {
    const file = logoFileName(s.logoUrl ?? '');
    if (!isLogoFileName(file)) continue;
    if (!usedBy.has(file)) usedBy.set(file, new Set());
    usedBy.get(file)!.add(s.organizationId);
  }
  const sponsorsRoot = path.join(assetsRoot, SPONSOR_LOGO_DIR);
  const organizationsRoot = path.join(assetsRoot, ORGANIZATION_LOGO_DIR);

  for (const organization of organizations) {
    if (organizationIds && !organizationIds.includes(organization.id)) continue;
    const id = String(organization.id);
    const target = path.join(sponsorsRoot, organization.slug);
    const idPathsAreOurs = id !== organization.slug && !slugs.has(id);
    try {
      // 1. sponsors/<id>/
      const idDir = path.join(sponsorsRoot, id);
      if (idPathsAreOurs && lexists(idDir) && fs.lstatSync(idDir).isDirectory()) {
        for (const name of fs.readdirSync(idDir)) {
          const from = path.join(idDir, name);
          if (!isRegularFile(from)) continue;
          count(placeFile(from, path.join(target, name), 'move'), 'movedFromIdPaths');
        }
        if (fs.readdirSync(idDir).length === 0) fs.rmdirSync(idDir);
      }
      // 2. legacy flat files this organization's sponsors use
      for (const [file, organizationsUsing] of usedBy) {
        if (!organizationsUsing.has(organization.id)) continue;
        const from = path.join(sponsorsRoot, file);
        if (!isRegularFile(from)) continue;
        const shared = [...organizationsUsing].some((other) => other !== organization.id);
        count(placeFile(from, path.join(target, file), shared ? 'copy' : 'move'), shared ? 'legacyCopied' : 'legacyMoved');
      }
      // 3. organizations/<id>.<ext>
      if (idPathsAreOurs) {
        for (const ext of ORGANIZATION_LOGO_EXTENSIONS) {
          const from = path.join(organizationsRoot, `${id}${ext}`);
          if (!isRegularFile(from)) continue;
          count(placeFile(from, path.join(organizationsRoot, `${organization.slug}${ext}`), 'move'), 'movedFromIdPaths');
        }
      }
    } catch (err) {
      logger.error(`Moving the logos of organization ${organization.slug} failed`, err as any);
    }
  }
  if (Object.values(summary).some((n) => n > 0)) logger.info('Logo files moved into the slug directories', summary);
  return summary;
}
