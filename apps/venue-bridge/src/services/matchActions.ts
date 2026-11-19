/**
 * The action rows of the statistics database and the per-player figures: shared with the API, which derives the
 * same figures from the matches it keeps (libs/venue-protocol/src/matchStats).
 */
export {
  normalizeActionRow, parseMatchTableName, listMatchTables, teamNamesOf, isAction, lastActionAt, derivePlayerStats, ratioText,
  type ActionRow, type TeamSide, type DerivedPlayer, type MatchTableName, type ShotRatio, type ReboundRatio,
} from '@korfbal-stream-kit/venue-protocol';
