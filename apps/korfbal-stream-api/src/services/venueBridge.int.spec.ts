import request from 'supertest';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {VENUE_EVENTS} from '@korfbal-stream-kit/venue-protocol';
import {io as ioClient, type Socket} from 'socket.io-client';
import app from '../main';
import {ensureOrganization, TEST_ORGANIZATION_SLUG, testDb as prisma, testOrganizationId} from '../../test-helpers';
import {createProductionScenario, type ProductionScenario} from '../../test-scenarios';
import {runWithOrganization} from './organizationContext';
import {setSetting} from './appSettings';
import * as liveState from './productionState';
import {clearVenueData} from './venueData';
import {clearStatsBridgeCache} from './stats/statsBridge';
import {VMIX_CALLSHEET_PUSH_KEY, pushForActiveOrganizations} from './vmixCallsheetPush';
import {apiUrl, connectFakeBridge, createBridgeKey, okReading, waitFor, type FakeBridge, type Payload} from '../test-support/fakeBridge';

const runDb = process.env.REQUIRE_DB === 'true';
const OTHER = 'venue-other';

describe.runIf(runDb)('venue-bridge: readings, status, configuration, vMix (integration)', () => {
  let orgId: number;
  let otherId: number;
  let key: string;
  const bridges: FakeBridge[] = [];
  const browsers: Socket[] = [];

  const connect = async (k = key, options?: Parameters<typeof connectFakeBridge>[1]) => {
    const bridge = await connectFakeBridge(k, options);
    bridges.push(bridge);
    return bridge;
  };
  /** A browser client of the organization, recording its events. */
  const browser = async (slug = TEST_ORGANIZATION_SLUG) => {
    const socket = ioClient(await apiUrl(), {transports: ['websocket'], auth: {organization: slug}, reconnection: false, forceNew: true});
    const events: Array<{event: string; args: Payload[]}> = [];
    socket.onAny((event: string, ...args: Payload[]) => events.push({event, args}));
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
    browsers.push(socket);
    return {socket, events, of: (name: string) => events.filter((e) => e.event === name)};
  };
  const status = async () => (await request(app).get('/api/venue-bridge/status')).body;

  beforeAll(async () => {
    orgId = await testOrganizationId();
    otherId = await ensureOrganization(prisma, OTHER, 'Venue Other');
    key = await createBridgeKey(orgId);
  });
  /** The venue settings of the test organization back to "not set" (what the tests save stays in the database). */
  const resetSettings = () => runWithOrganization(orgId, async () => {
    for (const settingKey of ['scoreboardUrl', 'shotclockUrl', 'matchStats', 'matchStatsBridgeToken', 'vmixInstances', 'vmixWebUrl', VMIX_CALLSHEET_PUSH_KEY]) await setSetting(settingKey, null as never);
  });

  beforeEach(resetSettings);

  afterEach(async () => {
    for (const b of bridges.splice(0)) b.close();
    for (const s of browsers.splice(0)) s.close();
    await new Promise((r) => setTimeout(r, 30));
    clearVenueData();
    clearStatsBridgeCache();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await resetSettings();
    await prisma.organization.deleteMany({where: {slug: OTHER}});
  });

  describe('readings', () => {
    it('answers the scoreboard routes from the bridge\'s readings, the shot clock with colour', async () => {
      const bridge = await connect();
      bridge.sendReading(okReading('score', [{home: 3, away: 2}]));
      bridge.sendReading(okReading('clock', ['15', '34']));
      bridge.sendReading(okReading('shotclock', [{time: '12'}]));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard/shotclock')).status).toBe(200));
      expect((await request(app).get('/api/scoreboard')).body).toEqual([{home: 3, away: 2}]);
      expect((await request(app).get('/api/scoreboard/clock')).body).toEqual(['15', '34']);
      expect((await request(app).get('/api/scoreboard/shotclock')).body).toEqual([{time: '12', color: 'orange'}]);
    });

    it('colours the shot clock red at 10 or less and green above 15', async () => {
      const bridge = await connect();
      bridge.sendReading(okReading('shotclock', [{time: 10}, {time: 16}]));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard/shotclock')).status).toBe(200));
      expect((await request(app).get('/api/scoreboard/shotclock')).body).toEqual([{time: 10, color: 'red'}, {time: 16, color: 'green'}]);
    });

    it('answers 502 with the old messages without a bridge and for a device that is not ok', async () => {
      expect((await request(app).get('/api/scoreboard')).body).toEqual({error: 'Failed to fetch scoreboard'});
      expect((await request(app).get('/api/scoreboard/clock')).body).toEqual({error: 'Failed to fetch scoreboard clock'});
      expect((await request(app).get('/api/scoreboard/shotclock')).body).toEqual({error: 'Failed to fetch shotclock'});
      const bridge = await connect();
      bridge.sendReading({device: 'score', ok: false, data: [], error: 'invalid'});
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard')).body).toEqual({error: 'Invalid response format from scoreboard'}));
    });

    it('ignores a malformed reading and keeps the previous one', async () => {
      const bridge = await connect();
      bridge.sendReading(okReading('clock', ['15', '34']));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard/clock')).status).toBe(200));
      bridge.socket.emit(VENUE_EVENTS.reading, {device: 'clock', ok: true, data: '15:35', readAt: new Date().toISOString()});
      bridge.socket.emit(VENUE_EVENTS.reading, {device: 'vmix', ok: true, data: [], readAt: new Date().toISOString()});
      bridge.socket.emit(VENUE_EVENTS.reading, {device: 'clock', ok: true, data: ['x'.repeat(5000)], readAt: new Date().toISOString()});
      bridge.sendReading(okReading('score', [1]));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard')).status).toBe(200));
      expect((await request(app).get('/api/scoreboard/clock')).body).toEqual(['15', '34']);
    });

    it('counts a reading as current for 10 s and the device as unavailable after', async () => {
      const bridge = await connect();
      bridge.sendReading(okReading('clock', ['1', '2']));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard/clock')).status).toBe(200));
      const real = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(real + 11_000);
      expect((await request(app).get('/api/scoreboard/clock')).status).toBe(502);
      expect((await status()).devices.clock.state).toBe('no-data');
    });

    it('makes every device unavailable at once when the bridge disconnects', async () => {
      const bridge = await connect();
      bridge.sendReading(okReading('score', [1]));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard')).status).toBe(200));
      bridge.close();
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard')).status).toBe(502));
      expect((await status()).connected).toBe(false);
    });

    it('keeps one organization\'s readings away from another\'s', async () => {
      const bridge = await connect();
      bridge.sendReading(okReading('score', [{home: 9}]));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard')).status).toBe(200));
      expect((await request(app).get('/api/scoreboard').set('X-Organization', OTHER)).status).toBe(502);
    });
  });

  describe('zaalklok', () => {
    let show: ProductionScenario | null = null;
    afterEach(async () => {
      liveState.discardLiveState(orgId);
      await show?.cleanup();
      show = null;
    });

    it('feeds the running show\'s venue clock and emits venue_clock_update only on change', async () => {
      show = await createProductionScenario(prisma, {organizationId: orgId, active: true, items: [{title: 'Zaalklok item', status: 'ACTIVE'}]});
      await runWithOrganization(orgId, liveState.restoreLiveState);
      const clients = await browser();
      const bridge = await connect();
      bridge.sendReading(okReading('clock', ['15', '34']));
      await vi.waitFor(() => expect(clients.of('venue_clock_update')).toHaveLength(1));
      bridge.sendReading(okReading('clock', ['15', '34']));
      bridge.sendReading(okReading('clock', ['15', '33']));
      await vi.waitFor(() => expect(clients.of('venue_clock_update')).toHaveLength(2));
      expect(clients.of('venue_clock_update').map((e) => e.args[0])).toEqual([{scoreboardTime: 934}, {scoreboardTime: 933}]);
    });

    it('only keeps the reading when no show runs', async () => {
      expect(liveState.liveOrganizationIds()).not.toContain(orgId);
      const clients = await browser();
      const bridge = await connect();
      bridge.sendReading(okReading('clock', ['15', '34']));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard/clock')).body).toEqual(['15', '34']));
      expect(clients.of('venue_clock_update')).toEqual([]);
    });
  });

  describe('status', () => {
    it('answers the status without a bridge', async () => {
      expect(await status()).toMatchObject({connected: false, name: null, config: {state: 'pending'}, devices: {score: {state: 'no-data'}}});
    });

    it('shows a connected bridge with its device states, and pushes venue_bridge_status on changes only', async () => {
      const clients = await browser();
      const bridge = await connect(key, {name: 'Zaal Fortuna'});
      await vi.waitFor(() => expect(clients.of('venue_bridge_status').length).toBeGreaterThan(0));
      expect(clients.of('venue_bridge_status').at(-1)?.args[0]).toMatchObject({connected: true, name: 'Zaal Fortuna'});

      bridge.sendReading({device: 'shotclock', ok: false, data: [], error: 'not-configured'});
      bridge.sendReading(okReading('clock', ['1', '1']));
      await vi.waitFor(async () => expect((await status()).devices.shotclock.state).toBe('not-configured'));
      const body = await status();
      expect(body).toMatchObject({connected: true, name: 'Zaal Fortuna', version: '1.0.0', devices: {clock: {state: 'ok'}, shotclock: {state: 'not-configured'}}});
      expect(body.connectedAt).toEqual(expect.any(String));

      await vi.waitFor(() => expect(clients.of('venue_bridge_status').at(-1)?.args[0].devices.shotclock.state).toBe('not-configured'));
      const before = clients.of('venue_bridge_status').length;
      bridge.sendReading(okReading('clock', ['1', '0']));
      bridge.sendReading(okReading('clock', ['0', '59']));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard/clock')).body).toEqual(['0', '59']));
      expect(clients.of('venue_bridge_status')).toHaveLength(before);

      bridge.close();
      await vi.waitFor(() => expect(clients.of('venue_bridge_status').at(-1)?.args[0].connected).toBe(false));
    });

    it('keeps only an http(s) page address of the bridge', async () => {
      const bad = await connect(key, {auth: {pageUrl: 'javascript:alert(1)'}});
      await vi.waitFor(async () => expect((await status()).connected).toBe(true));
      expect((await status()).pageUrl).toBeNull();
      bad.close();
      await vi.waitFor(async () => expect((await status()).connected).toBe(false));
      await connect(key, {auth: {pageUrl: 'http://10.0.0.9:3340'}});
      await vi.waitFor(async () => expect((await status()).pageUrl).toBe('http://10.0.0.9:3340'));
    });

    it('drops the bridge when the key it connected with is revoked', async () => {
      const ownKey = await createBridgeKey(orgId, 'to revoke');
      const keyId = (await prisma.organizationApiKey.findFirstOrThrow({where: {organizationId: orgId, name: 'to revoke'}, orderBy: {id: 'desc'}})).id;
      const bridge = await connect(ownKey);
      await vi.waitFor(async () => expect((await status()).connected).toBe(true));
      const res = await request(app).delete(`/api/organization/api-keys/${keyId}`);
      expect(res.status, res.text).toBe(200);
      await vi.waitFor(() => expect(bridge.socket.connected).toBe(false));
      await vi.waitFor(async () => expect((await status()).connected).toBe(false));
      // Revoking another key leaves a connected bridge alone
      const other = await connect(key);
      const spare = await createBridgeKey(orgId, 'spare');
      const spareId = (await prisma.organizationApiKey.findFirstOrThrow({where: {name: 'spare', organizationId: orgId}, orderBy: {id: 'desc'}})).id;
      await request(app).delete(`/api/organization/api-keys/${spareId}`);
      await new Promise((r) => setTimeout(r, 100));
      expect(other.socket.connected).toBe(true);
      expect(spare).toBeTruthy();
    });

    it('is open to a feed key', async () => {
      const res = await request(app).get(`/api/venue-bridge/status?key=${key}`).set('X-Organization', OTHER);
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });
  });

  describe('one bridge per organization', () => {
    it('disconnects the first bridge when a second connects and uses the second', async () => {
      const first = await connect();
      const second = await connect(key, {name: 'second'});
      await waitFor(() => !first.socket.connected);
      expect((await status()).name).toBe('second');
      second.sendReading(okReading('score', [1]));
      await vi.waitFor(async () => expect((await request(app).get('/api/scoreboard')).status).toBe(200));
      // The replaced bridge going away does not take the new one's data with it
      expect((await status()).connected).toBe(true);
    });
  });

  describe('configuration', () => {
    it('sends the organization\'s venue configuration on connect, never anything of another organization', async () => {
      await runWithOrganization(orgId, async () => {
        await setSetting('scoreboardUrl', 'http://10.0.0.5:8080');
        await setSetting('shotclockUrl', '');
        await setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: 'http://10.0.0.7:8088'}], targets: {}});
      });
      await runWithOrganization(otherId, () => setSetting('scoreboardUrl', 'http://other-secret.example'));
      const bridge = await connect();
      await waitFor(() => bridge.requestsOf(VENUE_EVENTS.configApply).length > 0);
      const {config} = bridge.requestsOf(VENUE_EVENTS.configApply)[0];
      expect(config).toMatchObject({
        scoreboard: {url: 'http://10.0.0.5:8080'}, shotclock: {url: null},
        stats: {pageUrl: null, mdbPath: null, mdbEnabled: true, shareHost: null, keepCopy: true},
        vmix: {instances: [{id: 'pc', name: 'PC', url: 'http://10.0.0.7:8088'}]},
      });
      expect(config.version).toEqual(expect.any(String));
      expect(JSON.stringify(config)).not.toContain('other-secret');
      expect(JSON.stringify(config)).not.toContain('sk_');
      await vi.waitFor(async () => expect((await status()).config).toEqual({state: 'applied', error: null}));
    });

    it('sends the configuration again after saving vMix instances, within a second', async () => {
      const bridge = await connect();
      await waitFor(() => bridge.requestsOf(VENUE_EVENTS.configApply).length === 1);
      const res = await request(app).put('/api/settings/vmix-instances').send({instances: [{id: 'nieuw', name: 'Nieuw', url: 'http://10.0.0.8:8088'}]});
      expect(res.status).toBe(200);
      await waitFor(() => bridge.requestsOf(VENUE_EVENTS.configApply).length === 2, 1500);
      expect(bridge.requestsOf(VENUE_EVENTS.configApply)[1].config.vmix.instances[0].id).toBe('nieuw');
    });

    it('sends it again after saving the scoreboard config or the statistics settings (debounced into one)', async () => {
      const bridge = await connect();
      await waitFor(() => bridge.requestsOf(VENUE_EVENTS.configApply).length === 1);
      await request(app).put('/api/settings/scoreboard-config').send({scoreboardUrl: 'http://10.0.0.9:8080', shotclockUrl: 'http://10.0.0.9:8081'});
      await request(app).put('/api/settings/match-stats').send({pageUrl: 'http://10.0.0.6/tweede.html', mdbPath: 'F{team}/WEDSTRIJDEN.mdb', mdbEnabled: true, shareHost: '10.0.0.6', keepCopy: false});
      await waitFor(() => bridge.requestsOf(VENUE_EVENTS.configApply).length >= 2, 1500);
      await new Promise((r) => setTimeout(r, 700));
      const sent = bridge.requestsOf(VENUE_EVENTS.configApply);
      expect(sent).toHaveLength(2);
      expect(sent[1].config).toMatchObject({
        scoreboard: {url: 'http://10.0.0.9:8080'}, shotclock: {url: 'http://10.0.0.9:8081'},
        stats: {pageUrl: 'http://10.0.0.6/tweede.html', mdbPath: 'F{team}/WEDSTRIJDEN.mdb', mdbEnabled: true, shareHost: '10.0.0.6', keepCopy: false},
      });
    });

    it('shows the configuration as refused with the bridge\'s reason', async () => {
      const bridge = await connect();
      bridge.on(VENUE_EVENTS.configApply, () => ({ok: false, error: 'scoreboard.url: Invalid url'}));
      await request(app).put('/api/settings/scoreboard-config').send({scoreboardUrl: 'http://10.0.0.10:8080'});
      await vi.waitFor(async () => expect((await status()).config).toEqual({state: 'refused', error: 'scoreboard.url: Invalid url'}), {timeout: 3000});
    });
  });

  describe('device addresses', () => {
    it('refuses addresses that are not http(s) and keeps the old ones', async () => {
      expect((await request(app).put('/api/settings/scoreboard-config').send({scoreboardUrl: 'http://10.0.0.10:8080', shotclockUrl: ''})).status).toBe(200);
      for (const bad of ['file:///etc/passwd', 'ftp://10.0.0.5/x', 'data:text/plain,hi']) {
        expect((await request(app).put('/api/settings/scoreboard-config').send({scoreboardUrl: bad})).status, bad).toBe(400);
        expect((await request(app).put('/api/settings/vmix-instances').send({instances: [{name: 'Main', url: bad}], targets: {}})).status, bad).toBe(400);
      }
      expect((await request(app).get('/api/settings/scoreboard-config')).body.scoreboardUrl).toBe('http://10.0.0.10:8080');
    });
  });

  describe('statistics settings', () => {
    it('saves valid settings and refuses a path outside the share, keeping the old ones', async () => {
      const valid = {pageUrl: 'tweede-scherm.html', mdbPath: 'F{team}/WEDSTRIJDEN.mdb', mdbEnabled: false, shareHost: null, keepCopy: true};
      const saved = await request(app).put('/api/settings/match-stats').send(valid);
      expect(saved.status, saved.text).toBe(200);
      expect((await request(app).get('/api/settings/match-stats')).body).toEqual(valid);
      for (const bad of [{mdbPath: '../WEDSTRIJDEN.mdb'}, {mdbPath: '/etc/x.mdb'}, {mdbPath: 'F1/data.txt'}, {pageUrl: '../x.html'}, {pageUrl: 'ftp://x/y.html'}]) {
        expect((await request(app).put('/api/settings/match-stats').send({...valid, ...bad})).status, JSON.stringify(bad)).toBe(400);
      }
      expect((await request(app).get('/api/settings/match-stats')).body).toEqual(valid);
    });

    it('ignores the old bridge address and token, and leaves them out of the backup', async () => {
      await runWithOrganization(orgId, async () => {
        await setSetting('matchStats', {bridgeUrl: 'http://old-bridge:3340'});
        await setSetting('matchStatsBridgeToken', 'old-bridge-secret');
      });
      expect((await request(app).get('/api/settings/match-stats')).body).not.toHaveProperty('bridgeUrl');
      const exported = await request(app).get('/api/backup/settings/export');
      expect(exported.text).not.toContain('old-bridge');
      expect(exported.body.some((s: {key: string}) => s.key === 'matchStatsBridgeToken')).toBe(false);
      await request(app).post('/api/backup/settings/import').send([{key: 'matchStats', value: {bridgeUrl: 'http://x', pageUrl: 'a.html'}}]);
      expect(JSON.stringify((await request(app).get('/api/backup/settings/export')).body)).not.toContain('bridgeUrl');
    });
  });

  describe('vMix through the bridge', () => {
    it('sends SetCountdown to the bridge for set-timer and answers as before', async () => {
      await runWithOrganization(orgId, () => setSetting('vmixInstances', {instances: [{id: 'pc', name: 'Stream-PC', url: 'http://10.0.0.7:8088'}], targets: {}}));
      const bridge = await connect();
      const res = await request(app).post('/api/vmix/set-timer').send({seconds: 30});
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ok: true, seconds: 30, instance: 'Stream-PC'});
      expect(bridge.requestsOf(VENUE_EVENTS.vmixCall)).toEqual([{function: 'countdown', commands: [{Function: 'SetCountdown', Value: '00:30'}]}]);
      expect(res.text).not.toContain('10.0.0.7');
    });

    it('answers 503 VENUE_BRIDGE_OFFLINE for set-timer, inputs and a manual push without a bridge', async () => {
      await runWithOrganization(orgId, async () => {
        await setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: 'http://10.0.0.7:8088'}], targets: {}});
        await setSetting(VMIX_CALLSHEET_PUSH_KEY, {enabled: true, input: 'Callsheet', positions: [], current: {titleField: 'Titel.Text'}});
      });
      for (const res of [
        await request(app).post('/api/vmix/set-timer').send({seconds: 30}),
        await request(app).get('/api/vmix/inputs'),
        await request(app).post('/api/vmix/callsheet/push'),
      ]) {
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('VENUE_BRIDGE_OFFLINE');
      }
    });

    it('answers 502 without the address when the bridge says vMix is unreachable', async () => {
      await runWithOrganization(orgId, () => setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: 'http://10.0.0.7:8088'}], targets: {}}));
      const bridge = await connect();
      bridge.on(VENUE_EVENTS.vmixCall, () => ({ok: false, error: 'unreachable'}));
      bridge.on(VENUE_EVENTS.vmixInputs, () => ({ok: false, error: 'unreachable'}));
      const timer = await request(app).post('/api/vmix/set-timer').send({seconds: 30});
      expect(timer.status).toBe(502);
      expect(timer.body).toEqual({error: 'vMix niet bereikbaar'});
      expect((await request(app).get('/api/vmix/inputs')).body).toEqual({error: 'vMix niet bereikbaar'});
    });

    it('lists the inputs the bridge reads', async () => {
      await runWithOrganization(orgId, () => setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: 'http://10.0.0.7:8088'}], targets: {}}));
      const bridge = await connect();
      const inputs = [{key: 'k1', number: 2, type: 'GT', title: 'Callsheet.gtzip', fields: ['Titel.Text']}];
      bridge.on(VENUE_EVENTS.vmixInputs, () => ({ok: true, instance: 'PC', inputs}));
      const res = await request(app).get('/api/vmix/inputs?function=callsheet');
      expect(res.body).toEqual({instance: 'PC', inputs});
      expect(bridge.requestsOf(VENUE_EVENTS.vmixInputs)[0]).toEqual({function: 'callsheet'});
      expect((await request(app).get('/api/vmix/inputs?function=onbekend')).status).toBe(400);
    });

    it('sends the callsheet push as one batch per round and skips an organization without a bridge quietly', async () => {
      const show = await createProductionScenario(prisma, {organizationId: orgId, active: true, items: [{title: 'Batch item', status: 'ACTIVE'}]});
      try {
        await runWithOrganization(orgId, async () => {
          await setSetting('vmixInstances', {instances: [{id: 'pc', name: 'PC', url: 'http://10.0.0.7:8088'}], targets: {}});
          await setSetting(VMIX_CALLSHEET_PUSH_KEY, {enabled: true, input: 'BatchInput', positions: [], current: {titleField: 'Titel.Text', timerField: 'Timer.Text'}});
        });
        await runWithOrganization(orgId, liveState.restoreLiveState);
        const info = vi.spyOn((await import('../utils/logger')).logger, 'info');
        await pushForActiveOrganizations();
        await pushForActiveOrganizations();
        expect(info.mock.calls.filter(([m]) => String(m).includes('push skipped'))).toHaveLength(1);

        const bridge = await connect();
        await pushForActiveOrganizations();
        const calls = bridge.requestsOf(VENUE_EVENTS.vmixCall);
        expect(calls).toHaveLength(1);
        expect(calls[0].function).toBe('callsheet');
        expect(calls[0].commands.length).toBeGreaterThanOrEqual(2);
        expect(calls[0].commands).toContainEqual({Function: 'SetText', Input: 'BatchInput', SelectedName: 'Titel.Text', Value: 'Batch item'});
      } finally {
        liveState.discardLiveState(orgId);
        await show.cleanup();
      }
    });
  });
});
