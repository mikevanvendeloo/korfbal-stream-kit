import fs from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import type {Writable} from 'node:stream';
import {Zip, ZipPassThrough} from 'fflate';
import {prisma} from './prisma';
import {getAssetsRoot} from './config';
import {requireOrganizationId} from './organizationContext';
import {organizationLogoRelPath, SPONSOR_LOGO_DIR} from './sponsorLogos';
import {assetFilePath, readAssetFile} from './reportSponsors';
import {findClubByTeamName} from '../utils/clubs';

/** No single image in the download is larger than this (uploads are at most 5 MB). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** A local asset path (not an http URL), relative to the assets root. */
function localAsset(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v || /^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return v.replace(/^[/\\]+/, '').replace(/^(?:uploads|storage)\//, '');
}

/**
 * The image files of the chosen organization, relative to the assets root (so the zip unpacks
 * straight into storage/):
 * - its sponsor logos: every file in sponsors/<slug>/;
 * - its own logo: organizations/<slug>.<ext>;
 * - the shared club logos it uses: the own club, the clubs of its matches (by team name, as the LIVE
 *   screens find them) and the clubs of its interview subjects;
 * - the shared player photos it uses: its interview subjects and the players of its own club.
 * Only regular files inside the assets root (no symlinks); sorted, without duplicates.
 */
export async function organizationImagePaths(root = getAssetsRoot()): Promise<string[]> {
  const organization = await prisma.organization.findUnique({
    where: {id: requireOrganizationId()},
    include: {club: {select: {id: true, logoUrl: true}}},
  });
  if (!organization) return [];
  const paths = new Set<string>();
  const add = (rel: string | null) => {
    if (rel && assetFilePath(rel, root)) paths.add(rel);
  };

  const sponsorDir = path.join(root, SPONSOR_LOGO_DIR, organization.slug);
  try {
    if (fs.lstatSync(sponsorDir).isDirectory()) {
      for (const name of fs.readdirSync(sponsorDir).sort()) add(`${SPONSOR_LOGO_DIR}/${organization.slug}/${name}`);
    }
  } catch {
    // no sponsor logos yet
  }
  add(organizationLogoRelPath(organization));

  const clubs = new Map<number, string | null>();
  if (organization.club) clubs.set(organization.club.id, organization.club.logoUrl);
  const matches = await prisma.matchSchedule.findMany({select: {homeTeamName: true, awayTeamName: true}});
  const teamNames = new Set(matches.flatMap((m) => [m.homeTeamName, m.awayTeamName]).filter(Boolean));
  for (const teamName of teamNames) {
    const club = await findClubByTeamName(prisma, teamName);
    if (club) clubs.set(club.id, club.logoUrl ?? null);
  }
  const subjects = await prisma.interviewSubject.findMany({
    select: {player: {select: {photoUrl: true, club: {select: {id: true, logoUrl: true}}}}},
  });
  for (const subject of subjects) {
    add(localAsset(subject.player.photoUrl));
    clubs.set(subject.player.club.id, subject.player.club.logoUrl);
  }
  for (const logoUrl of clubs.values()) add(localAsset(logoUrl));
  if (organization.club) {
    const players = await prisma.player.findMany({where: {clubId: organization.club.id}, select: {photoUrl: true}});
    for (const player of players) add(localAsset(player.photoUrl));
  }
  return [...paths].sort();
}

/**
 * Streams a zip (stored, not compressed: images are compressed already) of `paths` to `out`, reading
 * each file once with a size limit and waiting for the client when it reads slower than we write.
 */
export async function streamImagesZip(paths: string[], out: Writable, root = getAssetsRoot()): Promise<number> {
  let failed: Error | null = null;
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      failed = err;
      return;
    }
    out.write(chunk);
    if (final) out.end();
  });
  let files = 0;
  for (const rel of paths) {
    const data = readAssetFile(rel, MAX_FILE_BYTES, root);
    if (!Buffer.isBuffer(data)) continue; // gone, or too large, since the listing
    const entry = new ZipPassThrough(rel);
    zip.add(entry);
    entry.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), true);
    files++;
    if (failed) throw failed;
    if (out.destroyed) return files; // the client went away
    if (out.writableNeedDrain) await Promise.race([once(out, 'drain'), once(out, 'close')]);
  }
  zip.end();
  if (failed) throw failed;
  return files;
}
