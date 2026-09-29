import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PrismaClient} from '@prisma/client';
import {prisma as defaultPrisma} from './prisma';
import {getAssetsRoot} from './config';
import {seasonAssetDir} from './season';
import {logger} from '../utils/logger';

const LEGACY_PLAYERS_PREFIX = 'players/';
const LEGACY_TEAM_RESPONSES_DIR = 'team-responses';
const LEGACY_TEAM_RESPONSES_START_YEAR = 2025;
const SEASONS_DIR = 'seasons';

type MigrationDb = Pick<PrismaClient, 'player' | 'playerImage'>;

export interface SeasonAssetMigrationOptions {
  db?: MigrationDb;
  assetsRoot?: string;
}

export interface SeasonAssetMigrationSummary {
  /** Legacy photo files copied into a season dir by this run. */
  photosMoved: number;
  photoUrlsUpdated: number;
  /** Legacy photo files that are missing on disk and could not be found in any season dir either. */
  photosMissing: number;
  /** Legacy photo files missing on disk whose photoUrl was pointed at a copy found in a season dir. */
  photosRelinked: number;
  /** Legacy photo files kept because a different file with the same name already existed in the season dir. */
  legacyPhotosKept: number;
  /** Legacy photoUrls skipped because they are unsafe, not a regular file, or failed to migrate. */
  photosSkipped: number;
  sharedWithPlayerImage: number;
  teamResponsesMoved: number;
  teamResponsesSkipped: number;
}

type CopyOutcome = 'copied' | 'identical' | 'conflict' | 'missing';

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function fileHash(p: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(p)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function sameContent(a: string, b: string): Promise<boolean> {
  const [statA, statB] = await Promise.all([fs.stat(a), fs.stat(b)]);
  if (statA.size !== statB.size) return false;
  const [hashA, hashB] = await Promise.all([fileHash(a), fileHash(b)]);
  return hashA === hashB;
}

async function copyIfMissing(source: string, target: string): Promise<CopyOutcome> {
  if (!(await fileExists(source))) return 'missing';
  if (await fileExists(target)) return (await sameContent(source, target)) ? 'identical' : 'conflict';
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
  return 'copied';
}

/**
 * Looks for `fileName` in `seasons/<season>/players/`, preferring the given season dir.
 * Returns the asset URL (relative to the assets root) or undefined.
 */
async function findInSeasonDirs(assetsRoot: string, fileName: string, preferredUrl: string): Promise<string | undefined> {
  if (await fileExists(path.join(assetsRoot, preferredUrl))) return preferredUrl;
  let seasonDirs: string[];
  try {
    seasonDirs = (await fs.readdir(path.join(assetsRoot, SEASONS_DIR), {withFileTypes: true}))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();
  } catch {
    return undefined;
  }
  for (const dir of seasonDirs) {
    const url = `${SEASONS_DIR}/${dir}/players/${fileName}`;
    if (await fileExists(path.join(assetsRoot, url))) return url;
  }
  return undefined;
}

async function migratePlayerPhotos(db: MigrationDb, assetsRoot: string, summary: SeasonAssetMigrationSummary) {
  const players = await db.player.findMany({
    where: {photoUrl: {startsWith: LEGACY_PLAYERS_PREFIX}},
    select: {id: true, photoUrl: true, seasonId: true, season: {select: {startYear: true}}},
  });
  if (players.length === 0) return;

  const playerImages = await db.playerImage.findMany({select: {filename: true}});
  const manualUploads = new Set(playerImages.map((img) => toPosix(img.filename)));

  const byPhotoUrl = new Map<string, typeof players>();
  for (const player of players) {
    const url = player.photoUrl as string;
    byPhotoUrl.set(url, [...(byPhotoUrl.get(url) ?? []), player]);
  }

  for (const [legacyUrl, owners] of byPhotoUrl) {
    if (manualUploads.has(legacyUrl)) {
      summary.sharedWithPlayerImage++;
      continue;
    }
    // One bad entry must not abort the whole run: log it and move on.
    try {
      await migrateLegacyPhoto(db, assetsRoot, legacyUrl, owners, summary);
    } catch (err) {
      summary.photosSkipped++;
      logger.warn('Season asset migration: failed to migrate photo, skipped', {photoUrl: legacyUrl, error: (err as Error)?.message});
    }
  }
}

/** Only plain relative paths: no empty, `.` or `..` segments (so no absolute paths, dirs or traversal). */
function isSafeRelativeName(relativeName: string): boolean {
  return relativeName.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

type PhotoOwner = { seasonId: number; season: { startYear: number } };

async function migrateLegacyPhoto(
  db: MigrationDb,
  assetsRoot: string,
  legacyUrl: string,
  owners: PhotoOwner[],
  summary: SeasonAssetMigrationSummary,
) {
  const relativeName = legacyUrl.slice(LEGACY_PLAYERS_PREFIX.length);
  if (!isSafeRelativeName(relativeName)) {
    summary.photosSkipped++;
    logger.warn('Season asset migration: unsafe photoUrl, skipped', {photoUrl: legacyUrl});
    return;
  }
  const source = path.join(assetsRoot, LEGACY_PLAYERS_PREFIX, relativeName);
  const sourceStat = await fs.stat(source).catch(() => undefined);
  if (sourceStat && !sourceStat.isFile()) {
    summary.photosSkipped++;
    logger.warn('Season asset migration: photoUrl is not a regular file, skipped', {photoUrl: legacyUrl});
    return;
  }
  // The legacy file may only go once every season that references it has its own verified copy.
  let safeToDeleteSource = true;
  let conflict = false;

  const startYears = new Map(owners.map((o) => [o.seasonId, o.season.startYear]));
  for (const [seasonId, startYear] of startYears) {
    let targetUrl = `${seasonAssetDir({startYear}, 'players')}/${relativeName}`;
    const outcome = sourceStat ? await copyIfMissing(source, path.join(assetsRoot, targetUrl)) : 'missing';

    if (outcome === 'missing') {
      safeToDeleteSource = false;
      const found = await findInSeasonDirs(assetsRoot, path.basename(relativeName), targetUrl);
      if (!found) {
        summary.photosMissing++;
        logger.warn('Season asset migration: photo file missing, photoUrl left unchanged', {photoUrl: legacyUrl});
        continue;
      }
      summary.photosRelinked++;
      targetUrl = found;
    } else if (outcome === 'conflict') {
      safeToDeleteSource = false;
      conflict = true;
    } else if (outcome === 'copied') {
      summary.photosMoved++;
    }

    const {count} = await db.player.updateMany({where: {photoUrl: legacyUrl, seasonId}, data: {photoUrl: targetUrl}});
    summary.photoUrlsUpdated += count;
  }

  if (conflict) {
    summary.legacyPhotosKept++;
    logger.warn('Season asset migration: a different file already exists in the season dir, legacy file kept', {
      photoUrl: legacyUrl,
    });
  }
  if (safeToDeleteSource) await fs.rm(source, {force: true});
}

async function migrateTeamResponses(assetsRoot: string, summary: SeasonAssetMigrationSummary) {
  const legacyDir = path.join(assetsRoot, LEGACY_TEAM_RESPONSES_DIR);
  let entries;
  try {
    entries = await fs.readdir(legacyDir, {withFileTypes: true});
  } catch {
    return;
  }
  const targetDir = path.join(assetsRoot, seasonAssetDir({startYear: LEGACY_TEAM_RESPONSES_START_YEAR}, 'team-responses'));

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const source = path.join(legacyDir, entry.name);
    const target = path.join(targetDir, entry.name);
    try {
      if (await fileExists(target)) {
        summary.teamResponsesSkipped++;
        continue;
      }
      await fs.mkdir(targetDir, {recursive: true});
      await fs.rename(source, target);
      summary.teamResponsesMoved++;
    } catch (err) {
      summary.teamResponsesSkipped++;
      logger.warn('Season asset migration: failed to move team response, skipped', {file: entry.name, error: (err as Error)?.message});
    }
  }
}

/**
 * Moves pre-season KNKV assets into the per-season directories. Safe to run repeatedly:
 * already-migrated rows no longer match the legacy `players/` prefix and moved files are gone.
 * Manual PlayerImage uploads also live in `players/` and are left untouched.
 */
export async function migrateLegacySeasonAssets(options: SeasonAssetMigrationOptions = {}): Promise<SeasonAssetMigrationSummary> {
  const db = options.db ?? defaultPrisma;
  const assetsRoot = options.assetsRoot ?? getAssetsRoot();
  const summary: SeasonAssetMigrationSummary = {
    photosMoved: 0,
    photoUrlsUpdated: 0,
    photosMissing: 0,
    photosRelinked: 0,
    legacyPhotosKept: 0,
    photosSkipped: 0,
    sharedWithPlayerImage: 0,
    teamResponsesMoved: 0,
    teamResponsesSkipped: 0,
  };

  await migratePlayerPhotos(db, assetsRoot, summary);
  await migrateTeamResponses(assetsRoot, summary);

  logger.info('Season asset migration finished', summary);
  return summary;
}
