import {z} from 'zod';
import {
  deriveMatchFigures, isOwnTeamTable, MATCH_STATS_VERSION, normalizeActionRow, parseMatchTableName, type ActionRow,
} from '@korfbal-stream-kit/venue-protocol';
import {prisma} from '../prisma';
import {logger} from '../../utils/logger';
import {requireOrganizationId, runWithOrganization} from '../organizationContext';
import {connectedOrganizationIds, hasBridge} from '../venueBridge';
import {BridgeOfflineError, bridgeGet} from './statsBridge';
import {ownClubNames, resolveStatsTeam, type StatsTeam} from './statsTeam';

/**
 * Keeps the own team's matches from the statistics database (see openspec/specs/season-statistics). The API pulls:
 * `/matches` lists the tables with a fingerprint (action count, last action), `/matches/:table/rows` gives all rows
 * of one table. Only answers from the database file itself count (never the statistics page).
 */

export const SYNC_INTERVAL_MS = 60_000;
const MAX_ROWS = 20_000;

export type SyncState = {database: 'ok' | 'unavailable' | 'offline'; at: string; stored: number};

const ListEntry = z.object({
  table: z.string().min(1).max(200),
  actionCount: z.number().int().min(0),
  lastActionAt: z.number().nullable(),
});
const RowSchema = z.object({
  aktienummer: z.number(),
  speler: z.string().max(200).nullable(),
  tegenstander: z.string().max(200).nullable(),
  aktieomschrijving: z.string().max(500).nullable(),
  opstelling: z.string().max(40).nullable(),
  doelpuntenvoor: z.number(),
  doelpuntentegen: z.number(),
  tijdtotaal: z.number(),
  aktnummer: z.number(),
  optelveld: z.number(),
  absoluut: z.string().max(40).nullable(),
});
const RowsSchema = z.array(RowSchema).max(MAX_ROWS);

const states = new Map<number, SyncState>();
const running = new Map<number, Promise<SyncState>>();
/** Tables that are not the own team's, per organization: `team|table` -> fingerprint, so they are not fetched again. */
const skipped = new Map<number, Map<string, string>>();

export function clearStatsSync(): void {
  states.clear();
  running.clear();
  skipped.clear();
}

/** The last sync attempt of the organization in the context; null before the first. */
export function lastSyncState(): SyncState | null {
  return states.get(requireOrganizationId('statistics sync')) ?? null;
}

const fromDatabase = (headers: Record<string, string>) => {
  const source = headers['x-stats-source'];
  return (source === 'share' || source === 'copy') && !headers['x-stats-database'];
};

/**
 * One sync for the organization in the context, for the team of the active production; a running sync is shared.
 * With `team` (the last sync of a production that is switched off), it runs after a running sync, for that team.
 */
export function syncStatsMatches(team?: StatsTeam): Promise<SyncState> {
  const orgId = requireOrganizationId('statistics sync');
  const busy = running.get(orgId);
  if (busy && !team) return busy;
  const job = (busy ? busy.catch(() => null) : Promise.resolve(null))
    .then(() => sync(orgId, team))
    .finally(() => { if (running.get(orgId) === job) running.delete(orgId); });
  running.set(orgId, job);
  return job;
}

async function sync(orgId: number, chosenTeam?: StatsTeam): Promise<SyncState> {
  const done = (database: SyncState['database'], stored = 0): SyncState => {
    const state = {database, at: new Date().toISOString(), stored};
    states.set(orgId, state);
    return state;
  };
  if (!hasBridge(orgId)) return done('offline');
  try {
    const team = chosenTeam ?? await resolveStatsTeam();
    const teamNumber = Number(team.value);
    const clubNames = await ownClubNames();

    const list = await bridgeGet(`/matches?team=${team.value}`);
    if (list.status !== 200 || !fromDatabase(list.headers) || !Array.isArray(list.body)) return done('unavailable');

    const known = new Map((await prisma.statsMatch.findMany({where: {team: teamNumber}, select: {tableName: true, actionCount: true, lastActionAt: true}}))
      .map((m) => [m.tableName, `${m.actionCount}:${m.lastActionAt ?? ''}`]));
    const skip = skipped.get(orgId) ?? new Map<string, string>();
    skipped.set(orgId, skip);

    let stored = 0;
    for (const raw of list.body) {
      const entry = ListEntry.safeParse(raw);
      if (!entry.success) continue;
      const {table, actionCount, lastActionAt} = entry.data;
      const name = parseMatchTableName(table);
      if (!name?.date) continue;
      // Cheap check on the name first: another team number of the own club is never fetched
      if (!isOwnTeamTable(table, teamNumber, clubNames)) continue;
      const fingerprint = `${actionCount}:${lastActionAt ?? ''}`;
      if (known.get(table) === fingerprint || skip.get(`${team.value}|${table}`) === fingerprint) continue;

      const answer = await bridgeGet(`/matches/${encodeURIComponent(table)}/rows?team=${team.value}`);
      if (answer.status !== 200 || !fromDatabase(answer.headers)) return done('unavailable', stored);
      const parsed = RowsSchema.safeParse(answer.body);
      if (!parsed.success) {
        logger.warn('Statistics sync: unexpected rows from the bridge', {organizationId: orgId, table});
        continue;
      }
      const rows: ActionRow[] = parsed.data.map((r) => normalizeActionRow(r));
      if (!isOwnTeamTable(table, teamNumber, clubNames, rows)) {
        skip.set(`${team.value}|${table}`, fingerprint);
        continue;
      }
      await storeMatch(teamNumber, table, name.date, actionCount, lastActionAt, rows);
      stored += 1;
    }
    return done('ok', stored);
  } catch (err) {
    if (err instanceof BridgeOfflineError) return done('offline');
    throw err;
  }
}

async function storeMatch(team: number, table: string, date: string, actionCount: number, lastActionAt: number | null, rows: ActionRow[]) {
  const figures = deriveMatchFigures(rows);
  const data = {
    matchDate: new Date(`${date}T00:00:00.000Z`),
    ownTeam: figures.analysis.teams.own,
    opponentTeam: figures.analysis.teams.opponent,
    actionCount,
    lastActionAt: lastActionAt === null ? null : BigInt(Math.round(lastActionAt)),
    rows: rows as unknown as object,
    figures: figures as unknown as object,
    derivationVersion: MATCH_STATS_VERSION,
  };
  const organizationId = requireOrganizationId('statistics sync');
  await prisma.statsMatch.upsert({
    where: {organizationId_team_tableName: {organizationId, team, tableName: table}},
    create: {team, tableName: table, ...data},
    update: data,
  });
}

/** Sync every organization with a connected bridge, one after the other; failures are logged, never thrown. */
export async function syncAllConnected(): Promise<void> {
  for (const orgId of connectedOrganizationIds()) {
    await runWithOrganization(orgId, () => syncStatsMatches()).catch((err: unknown) =>
      logger.warn('Statistics sync failed', {organizationId: orgId, error: (err as Error)?.message}));
  }
}

let timer: NodeJS.Timeout | null = null;

/** The background sync: every minute over the connected bridges. Not started in tests. */
export function startStatsSyncLoop(): void {
  if (timer) return;
  timer = setInterval(() => void syncAllConnected(), SYNC_INTERVAL_MS);
  timer.unref();
}

/** A sync shortly after a bridge connects (after it got its configuration). */
export function syncSoon(organizationId: number, delayMs = 10_000): void {
  setTimeout(() => {
    void runWithOrganization(organizationId, () => syncStatsMatches()).catch((err: unknown) =>
      logger.warn('Statistics sync failed', {organizationId, error: (err as Error)?.message}));
  }, delayMs).unref();
}

/**
 * The last sync of a production that is switched off: its team's database once more, so the actions entered at the end
 * of the match are kept too (afterwards the sync follows the new production's team). In the background; never throws.
 */
export function syncFinalForTeam(team: StatsTeam): Promise<void> {
  return syncStatsMatches(team).then(
    () => undefined,
    (err: unknown) => { logger.warn('Final statistics sync failed', {organizationId: requireOrganizationId('statistics sync'), error: (err as Error)?.message}); },
  );
}
