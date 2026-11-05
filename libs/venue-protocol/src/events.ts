/**
 * The socket.io path of the venue-bridge on the API: a socket.io server of its own (default namespace), next to the
 * browsers' one, so only bridges get the large message limit. A reverse proxy must forward it with WebSocket upgrade.
 */
export const VENUE_BRIDGE_PATH = '/venue-bridge-socket';

/** Event names between the API and the venue-bridge. */
export const VENUE_EVENTS = {
  /** bridge -> API: a device reading (no answer) */
  reading: 'venue:reading',
  /** API -> bridge: the venue configuration (answer: ConfigApplyAnswer) */
  configApply: 'config:apply',
  /** API -> bridge: a statistics request (answer: StatsAnswer) */
  statsRequest: 'stats:request',
  /** API -> bridge: vMix function calls (answer: VmixCallAnswer) */
  vmixCall: 'vmix:call',
  /** API -> bridge: the inputs of a vMix (answer: VmixInputsAnswer) */
  vmixInputs: 'vmix:inputs',
} as const;

export type VenueEvent = typeof VENUE_EVENTS[keyof typeof VENUE_EVENTS];
