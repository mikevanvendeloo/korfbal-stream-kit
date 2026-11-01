import {derivePlayerStats, lastActionAt, listMatchTables, teamNamesOf, type DerivedPlayer} from './matchActions';
import {memoizedOnDatabase, readMatchActions, type StatsSource, type TeamChoice} from './mdbFile';
import {sexLookupOf, type SexLookup} from './teamStats';
import {derivedPlayerRows} from './flatRows';
import {StatsError} from './statsErrors';

export type CurrentPlayersResult = {
  source: StatsSource;
  readAt: string;
  team: TeamChoice | null;
  rows: Array<ReturnType<typeof derivedPlayerRows>[number] & {source: StatsSource; readAt: string}>;
};

/**
 * The player rows of the match with the latest entered action. The database also holds tables of coming
 * matches (definition rows only) and older test input, so the newest date is not the current match.
 * Shares the scan of `currentMatch`: polls within its cache lifetime reuse the result.
 */
export async function currentPlayers(team: string): Promise<CurrentPlayersResult> {
  const {source, readAt, team: chosen, players, names} = await currentMatch(team);
  return {source, readAt, team: chosen, rows: derivedPlayerRows(players, names).map((p) => ({...p, source, readAt}))};
}

export type CurrentMatch = {
  source: StatsSource;
  readAt: string;
  team: TeamChoice | null;
  players: DerivedPlayer[];
  names: {own: string | null; opponent: string | null};
  /** The sex of a player from `spelersover`; null when the database has no such table */
  sexOf: SexLookup | null;
};

/** The match with the latest action: whole-match players, team names and the sex of the players. Once per read of the file. */
export async function currentMatch(team: string): Promise<CurrentMatch> {
  const memo = await memoizedOnDatabase(team, 'current-match', async (db) => {
    let best: {rows: Awaited<ReturnType<typeof readMatchActions>>['data']; at: number} | null = null;
    for (const match of listMatchTables(db.getTableNames())) {
      const read = await readMatchActions(team, match.table);
      const at = lastActionAt(read.data);
      if (at !== null && (!best || at > best.at)) best = {rows: read.data, at};
    }
    if (!best) throw new StatsError(404, 'Geen gespeelde wedstrijd in het statistiekenbestand');
    const sexRows = db.getTableNames().includes('spelersover') ? db.getTable('spelersover').getData() : null;
    return {players: derivePlayerStats(best.rows), names: teamNamesOf(best.rows), sexOf: sexRows ? sexLookupOf(sexRows) : null};
  });
  return {source: memo.source, readAt: memo.readAt, team: memo.team, ...memo.value};
}
