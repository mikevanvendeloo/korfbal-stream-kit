import {
  VENUE_EVENTS, VmixCallAnswerSchema, VmixInputsAnswerSchema,
  type VmixCallAnswer, type VmixCallRequest, type VmixInputsAnswer, type VmixInputsRequest,
} from '@korfbal-stream-kit/venue-protocol';
import {askBridge} from './venueBridge';

/** The bridge carries out a batch (up to 100 calls, each with its own 1.5 s deadline there, the first failure stops it). */
const CALL_DEADLINE_MS = 5000;
const INPUTS_DEADLINE_MS = 3000;

/**
 * vMix is at the venue: every call goes through the organization's venue-bridge, which picks the instance from its
 * configuration. BridgeOfflineError when there is no bridge or it does not answer.
 */
export function vmixCall(request: VmixCallRequest): Promise<VmixCallAnswer> {
  return askBridge(VENUE_EVENTS.vmixCall, request, {deadlineMs: CALL_DEADLINE_MS, maxBytes: 2000, schema: VmixCallAnswerSchema});
}

export function vmixInputs(request: VmixInputsRequest): Promise<VmixInputsAnswer> {
  return askBridge(VENUE_EVENTS.vmixInputs, request, {deadlineMs: INPUTS_DEADLINE_MS, maxBytes: 5_000_000, schema: VmixInputsAnswerSchema});
}
