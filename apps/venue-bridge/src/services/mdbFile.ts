import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {config} from '../config';
import {logger} from '../logger';
import {StatsError} from './statsErrors';
import {shareHostOf, smbReachable, type Reach} from './smbReach';
import {listMatchTables, normalizeActionRow, type ActionRow, type MatchTableName} from './matchActions';

export const MAX_MDB_BYTES = 50 * 1024 * 1024;
export const MAX_HTML_BYTES = 512 * 1024;
const CACHE_MS = 3000;
/** Network load on the share: a changed file is read again at most this often, the local copy written at most this often */
const MIN_READ_MS = 10_000;
const COPY_EVERY_MS = 5 * 60_000;
const MDB_EXTENSIONS = new Set(['.mdb', '.accdb']);
export const HTML_EXTENSIONS = new Set(['.html', '.htm']);

/** The database is switched off (MDB_ENABLED=false) or cannot be used: the page is the only source. */
export class DatabaseUnavailableError extends StatsError {
  constructor(public reason: 'disabled' | 'unreachable', message = 'Database niet beschikbaar') {
    super(503, message);
  }
}

/** The team of `{team}` in MDB_PATH: only digits, so the resolved path still passes the safe path checks. */
export type TeamChoice = {value: string};
export const TEAM_PLACEHOLDER = '{team}';
export const usesTeam = (p: string) => p.includes(TEAM_PLACEHOLDER);
export const withTeam = (p: string, team: string) => p.split(TEAM_PLACEHOLDER).join(team);

/**
 * Wall-clock deadline on every share access (an SMB read can hang for minutes) and the base of the window a
 * failing share is skipped (doubling per failure in a row, at most MAX_DOWN_MS, reset on success).
 */
let shareDeadlineMs = 3000;
let shareDownMs = 5000;
const MAX_DOWN_MS = 60_000;
const REACH_CACHE_MS = 5000;
export function setShareTimings(deadlineMs: number, downMs: number): void {
  shareDeadlineMs = deadlineMs;
  shareDownMs = downMs;
}

/** The TCP probe before the mount is touched; tests can inject one. */
let probe: (host: string) => Promise<Reach> = (host) => smbReachable(host);
export function setSmbProbe(fn: ((host: string) => Promise<Reach>) | null): void {
  probe = fn ?? ((host) => smbReachable(host));
  reachCache = null;
}

/** The part of mdb-reader's MDBReader that is used. */
export interface MdbDatabase {
  getTableNames(): string[];
  getTable(name: string): {getData(): Record<string, unknown>[]};
}
export type MdbOpener = (file: Buffer) => MdbDatabase | Promise<MdbDatabase>;

let opener: MdbOpener | null = null;
/** The Access adapter (mdb-reader in a worker) registers itself here; tests can register a fake. */
export function setMdbOpener(fn: MdbOpener | null): void {
  opener = fn;
  cache.clear();
}

export type StatsSource = 'share' | 'copy';
export type Sourced<T> = {source: StatsSource; readAt: string; team: TeamChoice | null; data: T};

const bad = (message: string) => new StatsError(400, message);

/** STATS_DIR is not set: there is no share at all (a local copy can still answer). */
class ShareNotConfiguredError extends StatsError {
  constructor() {
    super(409, 'De statistiekenmap (STATS_DIR) is niet ingesteld op de bridge');
  }
}

/** The share is busy with an earlier operation that has not settled (a hung mount cannot be aborted). */
class ShareBusyError extends StatsError {
  constructor() {
    super(504, 'De gedeelde map is nog bezig met een vorige opdracht');
  }
}

function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, onSettled: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StatsError(504, 'De gedeelde map antwoordt niet')), shareDeadlineMs);
    let started: Promise<T>;
    try {
      started = work(AbortSignal.timeout(shareDeadlineMs));
    } catch (e) {
      clearTimeout(timer);
      onSettled();
      return reject(e);
    }
    started.then(
      (v) => { clearTimeout(timer); onSettled(); resolve(v); },
      (e) => { clearTimeout(timer); onSettled(); reject(e); },
    );
  });
}

/**
 * Resolve `relative` inside `root`: no absolute path, no `..`, only the allowed extensions, and the real
 * path (after symlinks) has to stay inside the real root and be a regular file within `maxBytes`.
 * Async, so a slow share never blocks the event loop.
 */
export async function resolveStatsFile(root: string, relative: string, extensions: Set<string> = MDB_EXTENSIONS, maxBytes = MAX_MDB_BYTES): Promise<string> {
  if (!root) throw new ShareNotConfiguredError();
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

let shareDownUntil = 0;
let shareFailures = 0;
/** At most one share operation in flight: until it settles nobody starts another fs call. */
let inFlight = false;
let reachCache: {at: number; ok: boolean} | null = null;

function markDown(): void {
  shareFailures += 1;
  shareDownUntil = Date.now() + Math.min(shareDownMs * 2 ** (shareFailures - 1), MAX_DOWN_MS);
}

async function hostReachable(host: string): Promise<boolean> {
  if (reachCache && Date.now() - reachCache.at < REACH_CACHE_MS) return reachCache.ok;
  const {ok} = await probe(host);
  reachCache = {at: Date.now(), ok};
  return ok;
}

/**
 * Work on the share: only when the statistics PC answers on the network (when its host is known), one
 * operation at a time, with a wall-clock deadline; a failing share is skipped for a growing while.
 */
async function onShare<T>(work: (signal: AbortSignal) => Promise<T>, host: string | null): Promise<T> {
  if (shareDownUntil > Date.now()) throw new StatsError(504, 'De gedeelde map is tijdelijk niet bereikbaar');
  if (inFlight) throw new ShareBusyError();
  if (host && !(await hostReachable(host))) {
    markDown();
    throw new StatsError(504, 'De statistiek-pc is niet bereikbaar op het netwerk');
  }
  if (inFlight) throw new ShareBusyError();
  inFlight = true;
  try {
    const result = await withDeadline(work, () => { inFlight = false; });
    shareFailures = 0;
    return result;
  } catch (err) {
    // A refused path or an unset share is a configuration problem, not a failing share
    if (err instanceof StatsError && (err.status === 400 || err.status === 409)) throw err;
    markDown();
    throw err instanceof StatsError ? err : new StatsError(502, 'De gedeelde map kon niet worden gelezen');
  }
}

/** One read of a file on the share (the page as a local .html, or the database), with a wall-clock deadline. */
export function readSharedFile(relative: string, extensions: Set<string> = MDB_EXTENSIONS, maxBytes = MAX_MDB_BYTES, host: string | null = shareHostOf(config)): Promise<Buffer> {
  return onShare(async (signal) => fs.promises.readFile(await resolveStatsFile(config.statsDir, relative, extensions, maxBytes), {signal}), host);
}

/** Modification time and size of the file on the share: a cheap check before reading it again. */
export function sharedFileStamp(relative: string, host: string | null = shareHostOf(config)): Promise<string> {
  return onShare(async () => {
    const stat = await fs.promises.stat(await resolveStatsFile(config.statsDir, relative));
    return `${stat.mtimeMs}:${stat.size}`;
  }, host);
}

/** `<hash of the relative path>-<file name>`: another path with the same file name never serves this copy. */
export function copyFileName(relative: string): string {
  return `${crypto.createHash('sha256').update(relative).digest('hex').slice(0, 8)}-${path.basename(relative)}`;
}

let copiedAt = 0;

/** The local copy, at most every COPY_EVERY_MS (at once when there is none yet). */
async function writeCopy(relative: string, buffer: Buffer): Promise<void> {
  try {
    const dir = config.copyDir;
    const target = path.join(dir, copyFileName(relative));
    const exists = await fs.promises.access(target).then(() => true, () => false);
    if (exists && Date.now() - copiedAt < COPY_EVERY_MS) return;
    copiedAt = Date.now();
    await fs.promises.mkdir(dir, {recursive: true});
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, buffer);
    await fs.promises.rename(tmp, target);
  } catch (err) {
    logger.warn('Statistics copy not written', {error: err instanceof Error ? err.message : String(err)});
  }
}

/** The file from the share (keeping a local copy), else the last local copy; without keepCopy only the share. */
export async function readStatsFile(relative: string, keepCopy = true, host: string | null = shareHostOf(config)): Promise<{buffer: Buffer; source: StatsSource; readAt: string; stamp?: string}> {
  let notConfigured: StatsError | null = null;
  try {
    const stamp = await sharedFileStamp(relative, host);
    const buffer = await readSharedFile(relative, MDB_EXTENSIONS, MAX_MDB_BYTES, host);
    if (keepCopy) await writeCopy(relative, buffer);
    return {buffer, source: 'share', readAt: new Date().toISOString(), stamp};
  } catch (err) {
    // A refused path never falls back; no STATS_DIR, an unreachable host or a missing file may use the copy
    if (err instanceof ShareNotConfiguredError) notConfigured = err;
    else if (err instanceof StatsError && (err.status === 400 || err.status === 409)) throw err;
    if (!keepCopy) throw err instanceof StatsError ? err : new StatsError(502, 'De gedeelde map kon niet worden gelezen');
    logger.warn('Statistics share not readable, trying the local copy', {error: err instanceof Error ? err.message : String(err)});
  }
  try {
    const file = await resolveStatsFile(config.copyDir, copyFileName(relative), MDB_EXTENSIONS);
    const [buffer, stat] = await Promise.all([fs.promises.readFile(file), fs.promises.stat(file)]);
    return {buffer, source: 'copy', readAt: stat.mtime.toISOString()};
  } catch {
    if (notConfigured) throw notConfigured;
    throw new StatsError(503, 'Het statistiekenbestand op de gedeelde map is niet bereikbaar en er is geen lokale kopie');
  }
}

type OpenedValue = {db: MdbDatabase; source: StatsSource; readAt: string; team: TeamChoice | null; memo: Map<string, unknown>};
type Opened = {at: number; stamp?: string; readAtMs?: number; value?: OpenedValue; pending?: Promise<OpenedValue>};
/** One entry per resolved path (the team folders F1, F2, ...). */
const cache = new Map<string, Opened>();

/** Everything that goes wrong in reaching the database (not a refused path) is one answer: not available. */
async function openDatabase(team: string): Promise<OpenedValue> {
  try {
    return await openDatabaseInner(team);
  } catch (err) {
    if (err instanceof DatabaseUnavailableError) throw err;
    if (err instanceof StatsError && err.status !== 400) throw new DatabaseUnavailableError('unreachable');
    throw err;
  }
}

async function openDatabaseInner(team: string): Promise<OpenedValue> {
  // Switched off: nothing of STATS_DIR, the share or the copy is touched
  if (!config.mdbEnabled) throw new DatabaseUnavailableError('disabled');
  if (!config.mdbPath) throw new StatsError(409, 'MDB_PATH is niet ingesteld op de bridge');
  const host = shareHostOf(config);
  const teamChoice = usesTeam(config.mdbPath) ? {value: team} : null;
  const mdbPath = teamChoice ? withTeam(config.mdbPath, team) : config.mdbPath;
  const keepCopy = config.keepCopy;
  const hit = cache.get(mdbPath);
  if (hit) {
    if (hit.pending) return hit.pending;
    if (hit.value && Date.now() - hit.at < CACHE_MS) return hit.value;
    // Over the network only the stamp while the file is unchanged; a changed file is read again at most every MIN_READ_MS
    if (hit.value?.source === 'share') {
      hit.at = Date.now();
      let stamp: string | null = null;
      try {
        stamp = await sharedFileStamp(mdbPath, host);
      } catch (err) {
        // The share is busy with an earlier operation: keep what we have, no new call
        if (err instanceof ShareBusyError) return hit.value;
      }
      if (stamp && (stamp === hit.stamp || Date.now() - (hit.readAtMs ?? 0) < MIN_READ_MS)) return hit.value;
    }
  }
  if (!opener) throw new StatsError(503, 'Het lezen van het statistiekenbestand is op deze bridge niet beschikbaar');
  const open = opener;
  const entry: Opened = {at: 0};
  entry.pending = (async () => {
    const file = await readStatsFile(mdbPath, keepCopy, host);
    try {
      entry.stamp = file.stamp;
      entry.readAtMs = Date.now();
      return {db: await open(file.buffer), source: file.source, readAt: file.readAt, team: teamChoice, memo: new Map<string, unknown>()};
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
      cache.delete(mdbPath);
      throw err;
    },
  );
  cache.set(mdbPath, entry);
  return entry.pending;
}

/** A derived result kept as long as this read of the file lives (a new read of the file starts empty). */
export async function memoizedOnDatabase<T>(team: string, key: string, compute: (db: MdbDatabase) => T | Promise<T>): Promise<{source: StatsSource; readAt: string; team: TeamChoice | null; value: T}> {
  const opened = await openDatabase(team);
  let value = opened.memo.get(key) as T | undefined;
  if (value === undefined) {
    value = await compute(opened.db);
    opened.memo.set(key, value);
  }
  return {source: opened.source, readAt: opened.readAt, team: opened.team, value};
}

export async function listStatsMatches(team: string): Promise<Sourced<MatchTableName[]>> {
  const {db, source, readAt, team: chosen} = await openDatabase(team);
  return {source, readAt, team: chosen, data: listMatchTables(db.getTableNames())};
}

/** The normalized rows of one match table, kept per read of the file. */
export async function readMatchActions(team: string, table: string): Promise<Sourced<ActionRow[]>> {
  const {db, source, readAt, team: chosen, memo} = await openDatabase(team);
  const key = `actions:${table}`;
  let rows = memo.get(key) as ActionRow[] | undefined;
  if (!rows) {
    // Only a listed match table: the name is never used to reach anything else
    if (!listMatchTables(db.getTableNames()).some((t) => t.table === table)) throw new StatsError(404, 'Wedstrijd niet gevonden');
    rows = db.getTable(table).getData().map(normalizeActionRow);
    memo.set(key, rows);
  }
  return {source, readAt, team: chosen, data: rows};
}

export async function readStatsPlayers(team: string): Promise<Sourced<Record<string, unknown>[]>> {
  const {db, source, readAt, team: chosen} = await openDatabase(team);
  if (!db.getTableNames().includes('spelersover')) throw new StatsError(404, 'Spelerstabel niet gevonden');
  return {source, readAt, team: chosen, data: db.getTable('spelersover').getData()};
}

export function clearMdbCache(): void {
  cache.clear();
  shareDownUntil = 0;
  shareFailures = 0;
  reachCache = null;
  copiedAt = 0;
}

/** For tests: forget everything about the share, also an operation that never settled. */
export function resetShareForTests(): void {
  clearMdbCache();
  inFlight = false;
}
