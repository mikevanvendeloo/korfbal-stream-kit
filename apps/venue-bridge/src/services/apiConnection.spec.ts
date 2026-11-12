import {createServer, type Server as HttpServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {Server, type Namespace, type Socket} from 'socket.io';
import {VENUE_BRIDGE_PATH, VENUE_EVENTS, type VenueReading} from '@korfbal-stream-kit/venue-protocol';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ApiConnection, type ApiHandlers} from './apiConnection';

const waitFor = async (fn: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('api connection', () => {
  let http: HttpServer;
  let io: Server;
  let ns: Namespace;
  let apiUrl: string;
  let serverSocket: Socket | null;
  let handshake: Record<string, unknown> | null;
  let connection: ApiConnection;
  let handlers: ApiHandlers;
  let acceptKey: string;
  const sock = () => serverSocket as Socket;

  beforeEach(async () => {
    serverSocket = null;
    handshake = null;
    acceptKey = 'good-key';
    http = createServer();
    io = new Server(http, {path: VENUE_BRIDGE_PATH});
    ns = io.of('/');
    ns.use((socket, next) => {
      if (socket.handshake.auth.key !== acceptKey) return next(Object.assign(new Error('API_KEY_INVALID'), {data: {code: 'API_KEY_INVALID'}}));
      handshake = socket.handshake.auth;
      return next();
    });
    ns.on('connection', (s) => {
      serverSocket = s;
    });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    apiUrl = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    handlers = {
      applyConfig: vi.fn(() => ({ok: true as const})),
      statsRequest: vi.fn(async (path: string) => (path.startsWith('/live') ? {status: 200, headers: {}, body: [1]} : {status: 404, headers: {}, body: {error: 'Niet gevonden'}})),
      vmixCall: vi.fn(async () => ({ok: true as const})),
      vmixInputs: vi.fn(async () => ({ok: true as const, instance: 'Main', inputs: []})),
      onConnected: vi.fn(),
    };
  });
  afterEach(async () => {
    connection?.stop();
    await io.close();
  });

  const connect = async (key = 'good-key') => {
    connection = new ApiConnection({apiUrl, apiKey: key, name: 'Zaal', pageUrl: 'http://bridge:3340'}, '1.2.3', handlers);
    connection.start();
  };

  const config = {
    scoreboard: {url: null}, shotclock: {url: null},
    stats: {pageUrl: null, mdbPath: null, mdbEnabled: false, shareHost: null, keepCopy: true},
    vmix: {instances: [], targets: {countdown: '', callsheet: ''}}, version: 'v1',
  };

  it('connects with key, name, version and page URL and tells the handlers', async () => {
    await connect();
    await waitFor(() => !!serverSocket);
    expect(handshake).toMatchObject({key: 'good-key', name: 'Zaal', version: '1.2.3', pageUrl: 'http://bridge:3340'});
    await waitFor(() => connection.state.connected);
    expect(connection.state.connected).toBe(true);
    expect(handlers.onConnected).toHaveBeenCalled();
  });

  it('sends readings to the API', async () => {
    await connect();
    // The server sees the socket before the client has its connect: a reading is only sent once the client is connected
    await waitFor(() => !!serverSocket && connection.state.connected);
    const received: VenueReading[] = [];
    sock().on(VENUE_EVENTS.reading, (r: VenueReading) => received.push(r));
    const reading: VenueReading = {device: 'clock', ok: true, data: ['1', '2'], readAt: new Date().toISOString()};
    connection.sendReading(reading);
    await waitFor(() => received.length === 1);
    expect(received[0]).toEqual(reading);
  });

  it('answers config:apply (and refuses an invalid body)', async () => {
    await connect();
    await waitFor(() => !!serverSocket);
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.configApply, {config})).toEqual({ok: true});
    expect(handlers.applyConfig).toHaveBeenCalledWith(config);
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.configApply, {config: {version: 1}})).toMatchObject({ok: false});
  });

  it('answers stats:request, 404 for an unknown path', async () => {
    await connect();
    await waitFor(() => !!serverSocket);
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.statsRequest, {path: '/live'})).toEqual({status: 200, headers: {}, body: [1]});
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.statsRequest, {path: '/../etc/passwd'})).toMatchObject({status: 404});
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.statsRequest, {nope: 1})).toMatchObject({status: 400});
  });

  it('answers vmix:call and vmix:inputs', async () => {
    await connect();
    await waitFor(() => !!serverSocket);
    const call = {function: 'countdown', commands: [{Function: 'SetCountdown', Value: '00:30'}]};
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.vmixCall, call)).toEqual({ok: true});
    expect(handlers.vmixCall).toHaveBeenCalledWith(call);
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.vmixInputs, {function: 'callsheet'})).toEqual({ok: true, instance: 'Main', inputs: []});
    expect(await sock().timeout(2000).emitWithAck(VENUE_EVENTS.vmixCall, {function: 'callsheet', commands: []})).toMatchObject({ok: false});
  });

  it('shows "Ongeldige API-sleutel" for a refused key, never logs the key and does not connect', async () => {
    const out: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out.push(String(chunk));
      return true;
    });
    await connect('wrong-secret-key');
    await waitFor(() => connection.state.error === 'Ongeldige API-sleutel');
    spy.mockRestore();
    expect(connection.state.connected).toBe(false);
    expect(out.join('')).not.toContain('wrong-secret-key');
  });

  it('reports the API as not reachable', async () => {
    connection = new ApiConnection({apiUrl: 'http://127.0.0.1:1', apiKey: 'k', name: 'Zaal', pageUrl: null}, '1', handlers);
    connection.start();
    await waitFor(() => connection.state.error === 'API niet bereikbaar');
    expect(connection.state.connected).toBe(false);
  });
});
