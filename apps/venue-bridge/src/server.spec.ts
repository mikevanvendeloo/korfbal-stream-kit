import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {config, setConfigForTests} from './config';
import {createApp} from './server';
import {ConfigCache} from './services/configCache';
import {DeviceReaders} from './services/deviceReaders';
import {VmixClient} from './services/vmixClient';
import {venueConfig} from './test-support/venueConfig';
import {handleStatsRequest} from './services/statsHandler';

const KEY = 'bridge-test-key-123';

describe('bridge server', () => {
  let device: http.Server;
  let vmixServer: http.Server;
  let deviceAnswers: Record<string, string>;
  let vmixUrls: string[];
  let cache: ConfigCache;
  let readers: DeviceReaders;
  let connected: boolean;
  let app: ReturnType<typeof createApp>;
  const original = {...config};

  const listen = async (s: http.Server) => {
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  };

  beforeEach(async () => {
    deviceAnswers = {'/score-as-array': '[{"home":1}]', '/time-as-array': '["15","34"]'};
    vmixUrls = [];
    device = http.createServer((req, res) => {
      if (req.url?.startsWith('/page.html')) return void res.end(fs.readFileSync(path.join(__dirname, 'test-fixtures/stats/tweede-scherm.html')));
      return void res.end(deviceAnswers[req.url ?? ''] ?? '[]');
    });
    vmixServer = http.createServer((req, res) => {
      vmixUrls.push(req.url ?? '');
      res.end('ok');
    });
    const deviceUrl = await listen(device);
    const vmixUrl = await listen(vmixServer);
    cache = new ConfigCache('/nonexistent/venue-bridge.json');
    cache.apply(venueConfig({
      scoreboard: {url: deviceUrl}, shotclock: {url: deviceUrl},
      stats: {pageUrl: `${deviceUrl}/page.html?secret-token=1`, mdbPath: null, mdbEnabled: false, shareHost: null, keepCopy: true},
      vmix: {instances: [{id: 'main', name: 'Main', url: vmixUrl}], targets: {countdown: 'main', callsheet: ''}},
    }));
    readers = new DeviceReaders({getConfig: () => cache.config, onReading: () => undefined});
    const vmix = new VmixClient(() => cache.config?.vmix);
    connected = false;
    app = createApp({
      name: 'Zaal', version: '1.0.0', apiKey: KEY, cache, readers, vmix,
      getApi: () => ({connected, since: null, error: null}), getConfigState: () => cache.state, getConfig: () => cache.config,
    });
  });
  afterEach(async () => {
    setConfigForTests(original);
    for (const s of [device, vmixServer]) {
      s.closeAllConnections();
      await new Promise((r) => s.close(r));
    }
  });

  it('answers /health without a key, also while the API is down', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ok: true, connected: false});
  });

  it('refuses the fallback routes without a key (401) and with a wrong one', async () => {
    for (const url of ['/api/scoreboard', '/api/scoreboard/clock', '/api/scoreboard/shotclock', '/api/stats/status']) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(401);
      expect(res.body).toEqual({error: 'API-sleutel ontbreekt'});
    }
    const wrong = await request(app).get('/api/scoreboard?key=nope');
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({error: 'Ongeldige API-sleutel'});
    expect((await request(app).post('/api/vmix/set-timer').send({seconds: 5})).status).toBe(401);
  });

  it('answers the scoreboard routes from the readings, the shot clock with colour (key as header or query)', async () => {
    await readers.round();
    expect((await request(app).get('/api/scoreboard').set('X-Api-Key', KEY)).body).toEqual([{home: 1}]);
    expect((await request(app).get(`/api/scoreboard/clock?key=${KEY}`)).body).toEqual(['15', '34']);

    deviceAnswers['/time-as-array'] = '[{"time": 12}, {"time": 30}, {"time": 5}]';
    await readers.round();
    const res = await request(app).get('/api/scoreboard/shotclock').set('X-Api-Key', KEY);
    expect(res.body).toEqual([{time: 12, color: 'orange'}, {time: 30, color: 'green'}, {time: 5, color: 'red'}]);
  });

  it('answers 502 with the API messages before a reading and for an invalid one', async () => {
    const before = await request(app).get('/api/scoreboard').set('X-Api-Key', KEY);
    expect(before.status).toBe(502);
    expect(before.body).toEqual({error: 'Failed to fetch scoreboard'});
    deviceAnswers['/score-as-array'] = '{"a":1}';
    await readers.round();
    const res = await request(app).get('/api/scoreboard').set('X-Api-Key', KEY);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({error: 'Invalid response format from scoreboard'});
  });

  it('passes /api/stats/* through to the statistics routes and uses the remembered team', async () => {
    const res = await request(app).get('/api/stats/matches').set('X-Api-Key', KEY);
    expect(res.status).toBe(200);
    expect(res.headers['x-stats-source']).toBe('page');
    expect((await request(app).get('/api/stats/nothing').set('X-Api-Key', KEY)).status).toBe(404);
    expect((await request(app).get('/api/stats/status?team=zz').set('X-Api-Key', KEY)).status).toBe(400);
  });

  it('carries out set-timer on the countdown vMix', async () => {
    const res = await request(app).post(`/api/vmix/set-timer?key=${KEY}`).send({seconds: 90});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true, seconds: 90, instance: 'Main'});
    expect(vmixUrls).toEqual(['/api/?Function=SetCountdown&Value=01%3A30']);
    expect((await request(app).post('/api/vmix/set-timer').set('X-Api-Key', KEY).send({seconds: -1})).status).toBe(400);
  });

  it('answers 502 for set-timer when vMix is off, without its address', async () => {
    cache.apply(venueConfig({vmix: {instances: [{id: 'main', name: 'Main', url: 'http://127.0.0.1:1'}], targets: {countdown: '', callsheet: ''}}}));
    const res = await request(app).post('/api/vmix/set-timer').set('X-Api-Key', KEY).send({seconds: 30});
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
  });

  it('shows the status without key or addresses', async () => {
    await readers.round();
    const res = await request(app).get('/bridge/status');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('http://');
    expect(res.body.devices.score.state).toBe('ok');
    expect(res.body.config).toMatchObject({state: 'applied', source: 'api'});
    expect(res.body.hosts.scoreboard).toBe(new URL(cache.config?.scoreboard.url ?? "").host);
  });

  it('serves a placeholder page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Venue-bridge');
  });

  it('calls a statistics handler in-process by path and query after a configuration change', async () => {
    expect((await handleStatsRequest('/matches?team=2')).status).toBe(200);
    cache.apply(venueConfig({stats: {pageUrl: null, mdbPath: null, mdbEnabled: false, shareHost: null, keepCopy: true}}));
    const after = await handleStatsRequest('/live');
    expect(after.status).toBe(409);
    expect(await handleStatsRequest('/../etc/passwd')).toMatchObject({status: 404});
    expect(await handleStatsRequest('nothing')).toMatchObject({status: 404});
  });
});
