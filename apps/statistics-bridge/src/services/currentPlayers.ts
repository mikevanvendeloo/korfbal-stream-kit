import {derivePlayerStats, lastActionAt, listMatchTables, teamNamesOf, type ActionRow, type DerivedPlayer} from './matchActions';
import {DatabaseUnavailableError, memoizedOnDatabase, readMatchActions, type StatsSource, type TeamChoice} from './mdbFile';
import {analyseMatch, type MatchAnalysis} from './matchAnalysis';
import {sexLookupOf, type SexLookup} from './teamStats';
import {derivedPlayerRows} from './flatRows';
import {StatsError} from './statsErrors';

export const ANALYSIS_NEEDS_DATABASE = 'De analyse heeft het statistiekenbestand nodig';

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
  /** The action rows of the match, in table order (for the analysis) */
  rows: ActionRow[];
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
    return {rows: best.rows, players: derivePlayerStats(best.rows), names: teamNamesOf(best.rows), sexOf: sexRows ? sexLookupOf(sexRows) : null};
  });
  return {source: memo.source, readAt: memo.readAt, team: memo.team, ...memo.value};
}

// One analysis per read of the file: the memoized match rows are the same array until the file is read again
const analyses = new WeakMap<ActionRow[], MatchAnalysis>();

/** The analysis of the match with the latest action. Database only: the page has no times, duels or zones. */
export async function currentAnalysis(team: string): Promise<{source: StatsSource; readAt: string; team: TeamChoice | null; analysis: MatchAnalysis}> {
  let m: CurrentMatch;
  try {
    m = await currentMatch(team);
  } catch (err) {
    // A refused path (400) stays a configuration error; no usable database or no played match: the analysis cannot be made
    if (err instanceof DatabaseUnavailableError || (err instanceof StatsError && err.status === 404)) throw new StatsError(503, ANALYSIS_NEEDS_DATABASE);
    throw err;
  }
  let analysis = analyses.get(m.rows);
  if (!analysis) analyses.set(m.rows, (analysis = analyseMatch(m.rows)));
  return {source: m.source, readAt: m.readAt, team: m.team, analysis};
}
