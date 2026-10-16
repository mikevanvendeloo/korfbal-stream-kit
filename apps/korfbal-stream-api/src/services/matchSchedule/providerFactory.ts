import type {MatchScheduleProvider} from './MatchScheduleProvider';
import {VrijwilligersMatchScheduleProvider} from './VrijwilligersMatchScheduleProvider';

/** Where an organization imports from (its MatchSource row) plus the club names of its own teams. */
export interface MatchScheduleProviderSource {
  provider: string;
  baseUrl: string;
  apiToken?: string | null;
  teamPrefixes?: string[];
}

// Picks the MatchScheduleProvider adapter for an organization's match source.
// To add a new source (e.g. Sportlink): implement MatchScheduleProvider in its own
// file, add a case below, and add its key to MATCH_SOURCE_PROVIDERS (schemas/organization.ts).
export function createMatchScheduleProvider(source: MatchScheduleProviderSource): MatchScheduleProvider {
  switch (source.provider) {
    case 'vrijwilligers':
      return new VrijwilligersMatchScheduleProvider(source.baseUrl, source.apiToken ?? undefined, source.teamPrefixes ?? []);
    default:
      throw new Error(`Unknown match source provider "${source.provider}". Supported providers: vrijwilligers`);
  }
}
