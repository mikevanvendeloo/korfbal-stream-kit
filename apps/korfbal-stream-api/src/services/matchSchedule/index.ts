import {config} from '../config';
import {VrijwilligersMatchScheduleProvider} from './VrijwilligersMatchScheduleProvider';
import type {MatchScheduleProvider} from './MatchScheduleProvider';

export type {MatchScheduleFetchParams, MatchScheduleProvider, NormalizedMatchItem} from './MatchScheduleProvider';

// Currently backed by the vrijwilligers system. Swap this instantiation for a
// different MatchScheduleProvider implementation (e.g. a Sportlink adapter)
// to change the source without touching the route layer.
export const matchScheduleProvider: MatchScheduleProvider = new VrijwilligersMatchScheduleProvider(
  () => config.matchScheduleBaseUrl,
  () => config.matchScheduleApiToken
);
