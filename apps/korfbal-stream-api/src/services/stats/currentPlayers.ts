import {derivePlayerStats, lastActionAt, listMatchTables, teamNamesOf} from './matchActions';
import {memoizedOnDatabase, readMatchActions, type StatsSource} from './mdbFile';
import {derivedPlayerRows} from './flatRows';
import {StatsError} from './statsErrors';

/**
 * The player rows of the match with the latest entered action. The database also holds tables of coming
 * matches (definition rows only) and older test input, so the newest date is not the current match.
 * Computed once per read of the file: polls within its cache lifetime reuse the result.
 */
export async function currentPlayers(): Promise<{source: StatsSource; readAt: string; rows: Array<ReturnType<typeof derivedPlayerRows>[number] & {source: StatsSource; readAt: string}>}> {
  const memo = await memoizedOnDatabase('current-players', async (db) => {
    let best: {rows: Awaited<ReturnType<typeof readMatchActions>>['data']; at: number} | null = null;
    for (const match of listMatchTables(db.getTableNames())) {
      const read = await readMatchActions(match.table);
      const at = lastActionAt(read.data);
      if (at !== null && (!best || at > best.at)) best = {rows: read.data, at};
    }
    if (!best) throw new StatsError(404, 'Geen gespeelde wedstrijd in het statistiekenbestand');
    return derivedPlayerRows(derivePlayerStats(best.rows), teamNamesOf(best.rows));
  });
  const {source, readAt} = memo;
  return {source, readAt, rows: memo.value.map((p) => ({...p, source, readAt}))};
}
