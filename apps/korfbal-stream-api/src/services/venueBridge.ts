import type {Socket} from 'socket.io';
import type {z} from 'zod';
import {requireOrganizationId} from './organizationContext';
import {logger} from '../utils/logger';

/**
 * The venue-bridge connections: at most one socket per organization (it replaces the previous one). Everything the
 * API needs from the venue — statistics, vMix, configuration — is asked over this socket with `askBridge`.
 */
export type BridgeConnection = {
  socket: Socket;
  name: string;
  version: string;
  pageUrl: string | null;
  connectedAt: Date;
  /** The API key it connected with */
  keyId: number;
};

const bridges = new Map<number, BridgeConnection>();

/** No bridge connected, no answer in time, or an answer that is not what was asked for. */
export class BridgeOfflineError extends Error {
  constructor() {
    super('Venue-bridge offline');
  }
}

export function getBridge(organizationId: number): BridgeConnection | undefined {
  return bridges.get(organizationId);
}

export function hasBridge(organizationId: number): boolean {
  return bridges.has(organizationId);
}

/** Registers the connection; a previous one of the organization is returned (and must be disconnected by the caller). */
export function setBridge(organizationId: number, connection: BridgeConnection): BridgeConnection | undefined {
  const previous = bridges.get(organizationId);
  bridges.set(organizationId, connection);
  return previous;
}

/** Removes the connection when it is still the registered one (a replaced bridge disconnects after the new one connected). */
export function removeBridge(organizationId: number, socket: Socket): boolean {
  if (bridges.get(organizationId)?.socket.id !== socket.id) return false;
  bridges.delete(organizationId);
  return true;
}

/** Disconnects the organization's bridge when it connected with this key (the key was revoked). */
export function disconnectBridgeOfKey(organizationId: number, keyId: number): void {
  const bridge = bridges.get(organizationId);
  if (bridge?.keyId === keyId) bridge.socket.disconnect(true);
}

export type AskOptions<T> = {deadlineMs: number; maxBytes: number; schema: z.ZodType<T>};

/**
 * One question to the bridge of the organization in the context, answered by the bridge's ack. Without a bridge, without
 * an answer within the deadline, with a malformed or too large answer: BridgeOfflineError.
 */
export async function askBridge<T>(event: string, payload: unknown, options: AskOptions<T>): Promise<T> {
  const bridge = bridges.get(requireOrganizationId('venue-bridge'));
  if (!bridge) throw new BridgeOfflineError();
  let answer: unknown;
  try {
    answer = await bridge.socket.timeout(options.deadlineMs).emitWithAck(event, payload);
  } catch {
    logger.debug('Venue-bridge did not answer', {event});
    throw new BridgeOfflineError();
  }
  if (JSON.stringify(answer ?? null).length > options.maxBytes) throw new BridgeOfflineError();
  const parsed = options.schema.safeParse(answer);
  if (!parsed.success) throw new BridgeOfflineError();
  return parsed.data;
}
