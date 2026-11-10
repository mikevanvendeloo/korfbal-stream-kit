import type {VenueConfig} from '@korfbal-stream-kit/venue-protocol';

export function venueConfig(patch: Partial<VenueConfig> = {}): VenueConfig {
  return {
    scoreboard: {url: null},
    shotclock: {url: null},
    stats: {pageUrl: null, mdbPath: null, mdbEnabled: false, shareHost: null, keepCopy: true},
    vmix: {instances: [], targets: {countdown: '', callsheet: ''}},
    version: 'v1',
    ...patch,
  };
}
