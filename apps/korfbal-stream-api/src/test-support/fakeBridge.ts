import type {AddressInfo} from 'node:net';
import {io as ioClient, type Socket} from 'socket.io-client';
import {VENUE_BRIDGE_PATH, VENUE_EVENTS, type VenueReading} from '@korfbal-stream-kit/venue-protocol';
import {httpServer} from '../main';
import {createApiKey} from '../services/apiKeys';
import {runWithOrganization} from '../services/organizationContext';

/** What the API sent: tests look into it freely. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Payload = any;
export type BridgeRequest = {event: string; payload: Payload};
type Handler = (payload: Payload) => unknown | Promise<unknown>;

export type FakeBridge = {
  socket: Socket;
  /** Every request the API sent to this bridge, in order */
  requests: BridgeRequest[];
  /** Replace how an event is answered; the default answers like an idle, healthy bridge. */
  on: (event: string, handler: Handler) => void;
  sendReading: (reading: Partial<VenueReading> & {device: VenueReading['device']}) => void;
  requestsOf: (event: string) => Payload[];
  close: () => void;
};

/** The app's Socket.io server on a random port (supertest does not start it). */
export async function apiUrl(): Promise<string> {
  if (!httpServer.listening) await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
}

/** A key for the organization (the full key is shown only now). */
export async function createBridgeKey(organizationId: number, name = 'fake bridge'): Promise<string> {
  return runWithOrganization(organizationId, async () => (await createApiKey(name)).key);
}

export const okReading = (device: VenueReading['device'], data: unknown[]): VenueReading => ({device, ok: true, data, readAt: new Date().toISOString()});

const defaults: Record<string, Handler> = {
  [VENUE_EVENTS.configApply]: () => ({ok: true}),
  [VENUE_EVENTS.statsRequest]: () => ({status: 404, headers: {}, body: {error: 'Niet gevonden'}}),
  [VENUE_EVENTS.vmixCall]: () => ({ok: true}),
  [VENUE_EVENTS.vmixInputs]: () => ({ok: true, instance: 'Fake', inputs: []}),
};

/** Connects like the venue-bridge does (auth.key) and answers the API's questions; rejects with connect_error when refused. */
export async function connectFakeBridge(key: string, options: {name?: string; headers?: Record<string, string>; auth?: Record<string, unknown>; query?: Record<string, string>} = {}): Promise<FakeBridge> {
  const url = await apiUrl();
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      path: VENUE_BRIDGE_PATH,
      transports: ['websocket'], reconnection: false, forceNew: true,
      auth: {key, name: options.name ?? 'fake bridge', version: '1.0.0', ...options.auth},
      extraHeaders: options.headers,
      query: options.query,
    });
    const handlers = {...defaults};
    const requests: BridgeRequest[] = [];
    for (const event of Object.keys(defaults)) {
      socket.on(event, async (payload: unknown, ack?: (answer: unknown) => void) => {
        requests.push({event, payload});
        ack?.(await handlers[event](payload));
      });
    }
    socket.once('connect', () => resolve({
      socket, requests,
      on: (event, handler) => { handlers[event] = handler; },
      sendReading: (reading) => { socket.emit(VENUE_EVENTS.reading, {ok: true, data: [], readAt: new Date().toISOString(), ...reading}); },
      requestsOf: (event) => requests.filter((r) => r.event === event).map((r) => r.payload),
      close: () => { socket.close(); },
    }));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

export async function waitFor(check: () => boolean, timeoutMs = 3000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('waitFor timed out');
}
