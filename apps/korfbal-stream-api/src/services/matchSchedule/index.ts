import {config} from '../config';
import {createMatchScheduleProvider} from './providerFactory';
import type {MatchScheduleProvider} from './MatchScheduleProvider';

export type {MatchScheduleFetchParams, MatchScheduleProvider, NormalizedMatchItem} from './MatchScheduleProvider';
export {createMatchScheduleProvider} from './providerFactory';

// Which adapter is active is controlled entirely by the MATCH_SCHEDULE_PROVIDER
// env var (see services/config.ts) - no code change needed to switch sources.
export const matchScheduleProvider: MatchScheduleProvider = createMatchScheduleProvider(
  config.matchScheduleProviderKey
);
