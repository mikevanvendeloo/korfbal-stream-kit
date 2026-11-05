/** The socket.io namespace of the venue-bridge on the API. */
export const VENUE_BRIDGE_NAMESPACE = '/venue-bridge';

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
