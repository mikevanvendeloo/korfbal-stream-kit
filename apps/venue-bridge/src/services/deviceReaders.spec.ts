import http from 'node:http';
import type {AddressInfo} from 'node:net';
import type {VenueReading} from '@korfbal-stream-kit/venue-protocol';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {venueConfig} from '../test-support/venueConfig';
import {DeviceReaders, RESEND_MS} from './deviceReaders';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

describe('device readers', () => {
  let server: http.Server;
  let handler: Handler;
  let base: string;
  let config = venueConfig();
  const readings: VenueReading[] = [];
  let readers: DeviceReaders;

  beforeEach(async () => {
    readings.length = 0;
    handler = (_req, res) => res.end('[]');
    server = http.createServer((req, res) => handler(req, res));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    config = venueConfig({scoreboard: {url: base}, shotclock: {url: base}});
    readers = new DeviceReaders({getConfig: () => config, onReading: (r) => readings.push(r)});
  });
  afterEach(async () => {
    vi.useRealTimers();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });

  const answer = (map: Record<string, string>): Handler => (req, res) => res.end(map[req.url ?? ''] ?? '[]');

  it('reads score, clock and shot clock and sends each reading with the device array unchanged', async () => {
    handler = answer({'/score-as-array': '[{"home":3,"away":2}]', '/time-as-array': '["15","34"]'});
    await readers.round();
    expect(readings.map((r) => [r.device, r.ok, r.data])).toEqual(expect.arrayContaining([
      ['score', true, [{home: 3, away: 2}]], ['clock', true, ['15', '34']], ['shotclock', true, ['15', '34']],
    ]));
    expect(readings).toHaveLength(3);
  });

  it('marks devices without a URL as not-configured', async () => {
    config = venueConfig({scoreboard: {url: base}});
    await readers.round();
    expect(readings.find((r) => r.device === 'shotclock')).toMatchObject({ok: false, data: [], error: 'not-configured'});
  });

  it('marks everything as not-configured without any configuration', async () => {
    const none = new DeviceReaders({getConfig: () => null, onReading: (r) => readings.push(r)});
    await none.round();
    expect(readings.map((r) => r.error)).toEqual(['not-configured', 'not-configured', 'not-configured']);
  });

  it('counts a slow device as unreachable at its 800 ms deadline while the others go on', async () => {
    handler = (req, res) => {
      if (req.url === '/score-as-array') return void setTimeout(() => res.end('[]'), 3000).unref();
      res.end('["1"]');
    };
    const started = Date.now();
    await readers.round();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(readings.find((r) => r.device === 'score')).toMatchObject({ok: false, error: 'unreachable'});
    expect(readings.find((r) => r.device === 'clock')).toMatchObject({ok: true});
  });

  it('counts an answer that is not an array, or too big, as invalid', async () => {
    handler = answer({'/score-as-array': '{"time": 12}', '/time-as-array': JSON.stringify(['x'.repeat(5000)])});
    await readers.round();
    expect(readings.find((r) => r.device === 'score')).toMatchObject({ok: false, data: [], error: 'invalid'});
    expect(readings.find((r) => r.device === 'shotclock')).toMatchObject({ok: false, error: 'invalid'});
  });

  it('counts an unreachable device', async () => {
    config = venueConfig({scoreboard: {url: 'http://127.0.0.1:1'}, shotclock: {url: base}});
    await readers.round();
    expect(readings.find((r) => r.device === 'score')).toMatchObject({ok: false, error: 'unreachable'});
  });

  it('skips a device still busy from the last round', async () => {
    let hits = 0;
    handler = (req, res) => {
      if (req.url === '/score-as-array') {
        hits += 1;
        return void setTimeout(() => res.end('[]'), 500).unref();
      }
      res.end('[]');
    };
    await Promise.all([readers.round(), readers.round()]);
    expect(hits).toBe(1);
  });

  it('sends only changes, and everything again after 5 s', async () => {
    handler = answer({'/time-as-array': '["15","34"]'});
    await readers.round();
    const first = readings.length;
    await readers.round();
    expect(readings).toHaveLength(first);

    handler = answer({'/time-as-array': '["15","33"]'});
    await readers.round();
    expect(readings.filter((r) => r.device === 'clock').map((r) => r.data)).toEqual([['15', '34'], ['15', '33']]);

    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(Date.now() + RESEND_MS + 1);
    const before = readings.length;
    await readers.round();
    expect(readings.length - before).toBe(3);
  });

  it('reads at the new address and sends at once after a URL change', async () => {
    await readers.round();
    const other = http.createServer((_req, res) => res.end('["9"]'));
    await new Promise<void>((r) => other.listen(0, '127.0.0.1', r));
    config = venueConfig({scoreboard: {url: base}, shotclock: {url: `http://127.0.0.1:${(other.address() as AddressInfo).port}`}});
    await readers.round();
    other.closeAllConnections();
    await new Promise((r) => other.close(r));
    expect(readings.filter((r) => r.device === 'shotclock').map((r) => r.data)).toEqual([[], ['9']]);
    expect(readers.latest('shotclock')?.data).toEqual(['9']);
  });
});
