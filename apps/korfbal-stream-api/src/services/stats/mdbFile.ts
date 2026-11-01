import fs from 'node:fs';
import path from 'node:path';
import {config, getAssetsRoot} from '../config';
import {getOrganizationSlug, requireOrganizationId} from '../organizationContext';
import {getMatchStats} from '../appSettings';
import {logger} from '../../utils/logger';
import {StatsError} from './statsErrors';
import {listMatchTables, normalizeActionRow, type ActionRow, type MatchTableName} from './matchActions';

export const MAX_MDB_BYTES = 100 * 1024 * 1024;
export const MAX_HTML_BYTES = 2_000_000;
const CACHE_MS = 3000;
const MDB_EXTENSIONS = new Set(['.mdb', '.accdb']);
export const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const ORGANIZATION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Wall-clock deadline on every share access (an SMB read can hang for minutes) and how long a failing share is skipped. */
let shareDeadlineMs = 3000;
let shareDownMs = 5000;
export function setShareTimings(deadlineMs: number, downMs: number): void {
  shareDeadlineMs = deadlineMs;
  shareDownMs = downMs;
}

/** The part of mdb-reader's MDBReader that is used. */
export interface MdbDatabase {
  getTableNames(): string[];
  getTable(name: string): {getData(): Record<string, unknown>[]};
}
export type MdbOpener = (file: Buffer) => MdbDatabase | Promise<MdbDatabase>;

let opener: MdbOpener | null = null;
/** The Access adapter (mdb-reader) registers itself here; tests can register a fake. */
export function setMdbOpener(fn: MdbOpener | null): void {
  opener = fn;
  cache.clear();
}

export type StatsSource = 'share' | 'copy';
export type Sourced<T> = {source: StatsSource; readAt: string; data: T};

const bad = (message: string) => new StatsError(400, message);

function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StatsError(504, 'De gedeelde map antwoordt niet')), shareDeadlineMs);
    work(AbortSignal.timeout(shareDeadlineMs)).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Resolve `relative` inside `root`: no absolute path, no `..`, only the allowed extensions, and the real
 * path (after symlinks) has to stay inside the real root and be a regular file within `maxBytes`.
 * Async, so a slow share never blocks the event loop.
 */
export async function resolveStatsFile(root: string, relative: string, extensions: Set<string> = MDB_EXTENSIONS, maxBytes = MAX_MDB_BYTES): Promise<string> {
  if (!root) throw new StatsError(409, 'De statistiekenmap (STATS_DIR) is niet ingesteld op de server');
  if (!relative || path.isAbsolute(relative) || relative.includes('\0') || /^[a-z]:/i.test(relative)) throw bad('Ongeldig pad naar het statistiekenbestand');
  if (relative.split(/[\\/]+/).some((part) => part === '..')) throw bad('Ongeldig pad naar het statistiekenbestand');
  if (!extensions.has(path.extname(relative).toLowerCase())) throw bad(`Alleen ${[...extensions].join(' of ')}-bestanden zijn toegestaan`);
  let realRoot: string;
  let real: string;
  try {
    realRoot = await fs.promises.realpath(root);
    real = await fs.promises.realpath(path.join(realRoot, relative));
  } catch {
    throw new StatsError(404, 'Het statistiekenbestand is niet gevonden');
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw bad('Ongeldig pad naar het statistiekenbestand');
  const stat = await fs.promises.stat(real);
  if (!stat.isFile()) throw new StatsError(404, 'Het statistiekenbestand is niet gevonden');
  if (stat.size > maxBytes) throw bad('Het statistiekenbestand is te groot');
  return real;
}

const shareDownUntil = new Map<number, number>();

/** One read of a file on the share, with a wall-clock deadline over resolve, stat and read together. */
export async function readSharedFile(relative: string, extensions: Set<string> = MDB_EXTENSIONS, maxBytes = MAX_MDB_BYTES): Promise<Buffer> {
  const orgId = requireOrganizationId('statistics share');
  if ((shareDownUntil.get(orgId) ?? 0) > Date.now()) throw new StatsError(504, 'De gedeelde map is tijdelijk niet bereikbaar');
  try {
    return await withDeadline(async (signal) => fs.promises.readFile(await resolveStatsFile(config.statsDir, relative, extensions, maxBytes), {signal}));
  } catch (err) {
    // A refused path or an unset share is a configuration problem, not a failing share
    if (err instanceof StatsError && (err.status === 400 || err.status === 409)) throw err;
    shareDownUntil.set(orgId, Date.now() + shareDownMs);
    throw err instanceof StatsError ? err : new StatsError(502, 'De gedeelde map kon niet worden gelezen');
  }
}

/** `<ASSETS_DIR>/stats/<organization slug>`: the slug comes from the organization, never from input. */
function copyDir(): string {
  const slug = getOrganizationSlug();
  if (!slug || !ORGANIZATION_SLUG.test(slug)) throw new StatsError(500, 'Organisatie onbekend');
  return path.join(getAssetsRoot(), 'stats', slug);
}

async function writeCopy(relative: string, buffer: Buffer): Promise<void> {
  try {
    const dir = copyDir();
    await fs.promises.mkdir(dir, {recursive: true});
    const target = path.join(dir, path.basename(relative));
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, buffer);
    await fs.promises.rename(tmp, target);
  } catch (err) {
    logger.warn('Statistics copy not written', {error: err instanceof Error ? err.message : String(err)});
  }
}

/** The file from the share (keeping a local copy), else the last local copy. */
export async function readStatsFile(relative: string): Promise<{buffer: Buffer; source: StatsSource; readAt: string}> {
  try {
    const buffer = await readSharedFile(relative);
    await writeCopy(relative, buffer);
    return {buffer, source: 'share', readAt: new Date().toISOString()};
  } catch (err) {
    if (err instanceof StatsError && (err.status === 400 || err.status === 409)) throw err;
    logger.warn('Statistics share not readable, trying the local copy', {error: err instanceof Error ? err.message : String(err)});
  }
  try {
    const dir = copyDir();
    const file = await resolveStatsFile(dir, path.basename(relative), MDB_EXTENSIONS);
    const [buffer, stat] = await Promise.all([fs.promises.readFile(file), fs.promises.stat(file)]);
    return {buffer, source: 'copy', readAt: stat.mtime.toISOString()};
  } catch {
    throw new StatsError(503, 'Het statistiekenbestand op de gedeelde map is niet bereikbaar en er is geen lokale kopie');
  }
}

type Opened = {at: number; path: string; value?: {db: MdbDatabase; source: StatsSource; readAt: string}; pending?: Promise<{db: MdbDatabase; source: StatsSource; readAt: string}>};
const cache = new Map<number, Opened>();

async function openDatabase() {
  const {mdbPath} = await getMatchStats();
  if (!mdbPath) throw new StatsError(409, 'Het statistiekenbestand is niet ingesteld: vul het pad in bij Instellingen');
  const orgId = requireOrganizationId('statistics database');
  const hit = cache.get(orgId);
  if (hit && hit.path === mdbPath) {
    if (hit.pending) return hit.pending;
    if (hit.value && Date.now() - hit.at < CACHE_MS) return hit.value;
  }
  if (!opener) throw new StatsError(503, 'Het lezen van het statistiekenbestand is op deze server niet beschikbaar');
  const open = opener;
  const entry: Opened = {at: 0, path: mdbPath};
  entry.pending = (async () => {
    const file = await readStatsFile(mdbPath);
    try {
      return {db: await open(file.buffer), source: file.source, readAt: file.readAt};
    } catch {
      throw new StatsError(502, 'Het statistiekenbestand kon niet worden gelezen');
    }
  })().then(
    (value) => {
      entry.value = value;
      entry.at = Date.now();
      entry.pending = undefined;
      return value;
    },
    (err) => {
      cache.delete(orgId);
      throw err;
    },
  );
  cache.set(orgId, entry);
  return entry.pending;
}

export async function listStatsMatches(): Promise<Sourced<MatchTableName[]>> {
  const {db, source, readAt} = await openDatabase();
  return {source, readAt, data: listMatchTables(db.getTableNames())};
}

export async function readMatchActions(table: string): Promise<Sourced<ActionRow[]>> {
  const {db, source, readAt} = await openDatabase();
  // Only a listed match table: the name is never used to reach anything else
  if (!listMatchTables(db.getTableNames()).some((t) => t.table === table)) throw new StatsError(404, 'Wedstrijd niet gevonden');
  return {source, readAt, data: db.getTable(table).getData().map(normalizeActionRow)};
}

export async function readStatsPlayers(): Promise<Sourced<Record<string, unknown>[]>> {
  const {db, source, readAt} = await openDatabase();
  if (!db.getTableNames().includes('spelersover')) throw new StatsError(404, 'Spelerstabel niet gevonden');
  return {source, readAt, data: db.getTable('spelersover').getData()};
}

export function clearMdbCache(): void {
  cache.clear();
  shareDownUntil.clear();
}
