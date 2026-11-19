import {derivePlayerStats, type ActionRow, type DerivedPlayer} from './matchActions';
import {analyseMatch, type MatchAnalysis} from './matchAnalysis';

/**
 * The version of the derivation. Raise it whenever analyseMatch or derivePlayerStats gives other figures for the
 * same rows: the API then derives its stored matches again from their rows.
 */
export const MATCH_STATS_VERSION = 2;

/** Everything the API keeps per match, derived from its rows. */
export type MatchFigures = {analysis: MatchAnalysis; players: DerivedPlayer[]};

export function deriveMatchFigures(rows: ActionRow[]): MatchFigures {
  return {analysis: analyseMatch(rows), players: derivePlayerStats(rows)};
}
