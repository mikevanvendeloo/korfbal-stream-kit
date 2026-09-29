import {config} from '../config';
import {createMatchScheduleProvider} from './providerFactory';
import type {MatchScheduleProvider} from './MatchScheduleProvider';

export type {MatchScheduleFetchParams, MatchScheduleProvider, NormalizedMatchItem} from './MatchScheduleProvider';
export {InvalidMatchScheduleResponseError} from './MatchScheduleProvider';
export {createMatchScheduleProvider} from './providerFactory';

// Which adapter is active is controlled entirely by the MATCH_SCHEDULE_PROVIDER
// env var (see services/config.ts) - no code change needed to switch sources.
//
// Resolved on use rather than at import time: an unknown provider key must only
// break the match import, not stop the whole API (scoreboard, show control, vMix)
// from starting.
export function getMatchScheduleProvider(): MatchScheduleProvider {
  return createMatchScheduleProvider(config.matchScheduleProviderKey);
}
