import {config} from '../config';
import type {MatchScheduleProvider} from './MatchScheduleProvider';
import {VrijwilligersMatchScheduleProvider} from './VrijwilligersMatchScheduleProvider';

// Deploy-time switch (MATCH_SCHEDULE_PROVIDER env var, see services/config.ts) that
// picks which MatchScheduleProvider adapter to wire up - no code change needed to
// switch between adapters that are already registered here.
//
// To add a new source (e.g. Sportlink): implement MatchScheduleProvider in its own
// file, add a case below, and point MATCH_SCHEDULE_PROVIDER at its key.
export function createMatchScheduleProvider(providerKey: string): MatchScheduleProvider {
  switch (providerKey) {
    case 'vrijwilligers':
      return new VrijwilligersMatchScheduleProvider(
        () => config.matchScheduleBaseUrl,
        () => config.matchScheduleApiToken
      );
    default:
      throw new Error(
        `Unknown MATCH_SCHEDULE_PROVIDER "${providerKey}". Supported providers: vrijwilligers`
      );
  }
}
