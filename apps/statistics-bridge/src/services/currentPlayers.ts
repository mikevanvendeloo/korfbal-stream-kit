import {derivePlayerStats, lastActionAt, listMatchTables, teamNamesOf} from './matchActions';
import {memoizedOnDatabase, readMatchActions, type StatsSource, type TeamChoice} from './mdbFile';
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
 * Computed once per read of the file: polls within its cache lifetime reuse the result.
 */
export async function currentPlayers(team: string): Promise<CurrentPlayersResult> {
  const memo = await memoizedOnDatabase(team, 'current-players', async (db) => {
    let best: {rows: Awaited<ReturnType<typeof readMatchActions>>['data']; at: number} | null = null;
    for (const match of listMatchTables(db.getTableNames())) {
      const read = await readMatchActions(team, match.table);
      const at = lastActionAt(read.data);
      if (at !== null && (!best || at > best.at)) best = {rows: read.data, at};
    }
    if (!best) throw new StatsError(404, 'Geen gespeelde wedstrijd in het statistiekenbestand');
    return derivedPlayerRows(derivePlayerStats(best.rows), teamNamesOf(best.rows));
  });
  const {source, readAt, team: chosen} = memo;
  return {source, readAt, team: chosen, rows: memo.value.map((p) => ({...p, source, readAt}))};
}
