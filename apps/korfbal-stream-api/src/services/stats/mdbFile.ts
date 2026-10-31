import fs from 'node:fs';
import path from 'node:path';
import {config} from '../config';
import {requireOrganizationId} from '../organizationContext';
import {getMatchStats} from '../appSettings';
import {StatsError} from './statsErrors';
import {listMatchTables, normalizeActionRow, type ActionRow, type MatchTableName} from './matchActions';

export const MAX_MDB_BYTES = 100 * 1024 * 1024;
const CACHE_MS = 3000;
const ALLOWED_EXTENSIONS = new Set(['.mdb', '.accdb']);

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

const bad = (message: string) => new StatsError(400, message);

/**
 * Resolve `relative` inside `root`: no absolute path, no `..`, only .mdb/.accdb, and the real path (after
 * symlinks) has to stay inside the real root and be a regular file within the size limit.
 */
export function resolveStatsFile(root: string, relative: string): string {
  if (!root) throw new StatsError(409, 'De statistiekenmap (STATS_DIR) is niet ingesteld op de server');
  if (!relative || path.isAbsolute(relative) || relative.includes('\0') || /^[a-z]:/i.test(relative)) throw bad('Ongeldig pad naar het statistiekenbestand');
  if (relative.split(/[\\/]+/).some((part) => part === '..')) throw bad('Ongeldig pad naar het statistiekenbestand');
  if (!ALLOWED_EXTENSIONS.has(path.extname(relative).toLowerCase())) throw bad('Alleen .mdb- of .accdb-bestanden zijn toegestaan');
  let realRoot: string;
  let real: string;
  try {
    realRoot = fs.realpathSync(root);
    real = fs.realpathSync(path.join(realRoot, relative));
  } catch {
    throw new StatsError(404, 'Het statistiekenbestand is niet gevonden');
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw bad('Ongeldig pad naar het statistiekenbestand');
  const stat = fs.statSync(real);
  if (!stat.isFile()) throw new StatsError(404, 'Het statistiekenbestand is niet gevonden');
  if (stat.size > MAX_MDB_BYTES) throw bad('Het statistiekenbestand is te groot');
  return real;
}

type Opened = {at: number; db?: MdbDatabase; pending?: Promise<MdbDatabase>; path: string};
const cache = new Map<number, Opened>();

async function openDatabase(): Promise<MdbDatabase> {
  const {mdbPath} = await getMatchStats();
  if (!mdbPath) throw new StatsError(409, 'Het statistiekenbestand is niet ingesteld: vul het pad in bij Instellingen');
  const file = resolveStatsFile(config.statsDir, mdbPath);
  const orgId = requireOrganizationId('statistics database');
  const hit = cache.get(orgId);
  if (hit && hit.path === file) {
    if (hit.pending) return hit.pending;
    if (hit.db && Date.now() - hit.at < CACHE_MS) return hit.db;
  }
  if (!opener) throw new StatsError(503, 'Het lezen van het statistiekenbestand is op deze server niet beschikbaar');
  const open = opener;
  const entry: Opened = {at: 0, path: file};
  entry.pending = (async () => open(await fs.promises.readFile(file)))().then(
    (db) => {
      entry.db = db;
      entry.at = Date.now();
      entry.pending = undefined;
      return db;
    },
    () => {
      cache.delete(orgId);
      throw new StatsError(502, 'Het statistiekenbestand kon niet worden gelezen');
    },
  );
  cache.set(orgId, entry);
  return entry.pending;
}

export async function listStatsMatches(): Promise<MatchTableName[]> {
  return listMatchTables((await openDatabase()).getTableNames());
}

export async function readMatchActions(table: string): Promise<ActionRow[]> {
  const db = await openDatabase();
  // Only a listed match table: the name is never used to reach anything else
  if (!listMatchTables(db.getTableNames()).some((t) => t.table === table)) throw new StatsError(404, 'Wedstrijd niet gevonden');
  return db.getTable(table).getData().map(normalizeActionRow);
}

export async function readStatsPlayers(): Promise<Record<string, unknown>[]> {
  const db = await openDatabase();
  if (!db.getTableNames().includes('spelersover')) throw new StatsError(404, 'Spelerstabel niet gevonden');
  return db.getTable('spelersover').getData();
}

export function clearMdbCache(): void {
  cache.clear();
}
