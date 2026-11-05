import request from 'supertest';
import app from '../main';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {getSetting, setSetting, VMIX_URL_KEY} from '../services/appSettings';
import {VMIX_INSTANCES_KEY} from '../services/vmixInstances';
import {VMIX_CALLSHEET_PUSH_KEY} from '../services/vmixCallsheetPush';
import {inTestOrganization, testOrganizationId} from '../../test-helpers';
import {connectFakeBridge, createBridgeKey, type FakeBridge} from '../test-support/fakeBridge';

const runDb = process.env.REQUIRE_DB === 'true';

// vMix itself is at the venue: the API asks the venue-bridge, which picks the instance and talks to vMix (its own tests).
const INPUTS = [
  {key: '11111111-aaaa-bbbb-cccc-000000000001', number: 1, type: 'Capture', title: 'Camera 1', fields: []},
  {key: '22222222-aaaa-bbbb-cccc-000000000002', number: 2, type: 'GT', title: 'Callsheet.gtzip', fields: ['Titel.Text', 'Timer.Text']},
];

describe.runIf(runDb)('vMix instances (integration)', () => {
  const streamUrl = 'http://10.0.0.1:8088';
  const schermUrl = 'http://10.0.0.2:8088';
  let previous: { instances: unknown; url: unknown } = {instances: null, url: null};
  let bridge: FakeBridge;
  let key: string;

  beforeAll(async () => {
    previous = {instances: await inTestOrganization(() => getSetting(VMIX_INSTANCES_KEY)), url: await inTestOrganization(() => getSetting(VMIX_URL_KEY))};
    key = await createBridgeKey(await testOrganizationId());
  });

  beforeEach(async () => {
    bridge = await connectFakeBridge(key);
    bridge.on('vmix:inputs', () => ({ok: true, instance: 'Scherm-PC', inputs: INPUTS}));
  });

  afterEach(() => bridge.close());

  afterAll(async () => {
    await inTestOrganization(() => setSetting(VMIX_INSTANCES_KEY, previous.instances as never));
    await inTestOrganization(() => setSetting(VMIX_URL_KEY, previous.url as never));
  });

  it('stores several vMix instances and which one each function uses', async () => {
    const res = await request(app).put('/api/settings/vmix-instances').send({
      instances: [{name: 'Stream-PC', url: streamUrl}, {id: 'scherm-pc', name: 'Scherm-PC', url: schermUrl}],
      targets: {countdown: 'scherm-pc'},
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      instances: [{id: 'stream-pc', name: 'Stream-PC', url: streamUrl}, {id: 'scherm-pc', name: 'Scherm-PC', url: schermUrl}],
      targets: {countdown: 'scherm-pc', callsheet: ''},
    });

    expect((await request(app).get('/api/settings/vmix-instances')).body).toEqual(res.body);
    // The single URL is the first instance
    expect((await request(app).get('/api/settings/vmix-url')).body).toEqual({vmixWebUrl: streamUrl});
  });

  it('sends the countdown to the vMix chosen for it, or to the one in the request', async () => {
    await request(app).put('/api/settings/vmix-instances').send({
      instances: [{id: 'stream-pc', name: 'Stream-PC', url: streamUrl}, {id: 'scherm-pc', name: 'Scherm-PC', url: schermUrl}],
      targets: {countdown: 'scherm-pc'},
    });

    const res = await request(app).post('/api/vmix/set-timer').send({seconds: 30});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ok: true, seconds: 30, instance: 'Scherm-PC'});
    // The bridge picks the instance from its configuration: the countdown function, no instance named
    expect(bridge.requestsOf('vmix:call')).toEqual([{function: 'countdown', commands: [{Function: 'SetCountdown', Value: '00:30'}]}]);

    const named = await request(app).post('/api/vmix/set-timer').send({seconds: 10, instanceId: 'stream-pc'});
    expect(named.body).toMatchObject({instance: 'Stream-PC'});
    expect(bridge.requestsOf('vmix:call')[1]).toEqual({function: 'countdown', instanceId: 'stream-pc', commands: [{Function: 'SetCountdown', Value: '00:10'}]});

    const unknown = await request(app).post('/api/vmix/set-timer').send({seconds: 10, instanceId: 'weg'});
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('vMix instance "weg" is not configured');
  });

  it('answers 502 without the vMix address when the bridge cannot reach vMix', async () => {
    await request(app).put('/api/settings/vmix-instances').send({
      instances: [{id: 'stream-pc', name: 'Stream-PC', url: 'http://127.0.0.1:1'}],
    });
    bridge.on('vmix:call', () => ({ok: false, error: 'unreachable'}));
    const res = await request(app).post('/api/vmix/set-timer').send({seconds: 30});
    expect(res.status).toBe(502);
    expect(res.body).toEqual({error: 'vMix niet bereikbaar'});
    expect(res.text).not.toContain('127.0.0.1');
  });

  it('lists the inputs of the chosen vMix, with the text fields of each title', async () => {
    await request(app).put('/api/settings/vmix-instances').send({
      instances: [{id: 'stream-pc', name: 'Stream-PC', url: streamUrl}, {id: 'scherm-pc', name: 'Scherm-PC', url: schermUrl}],
      targets: {callsheet: 'scherm-pc'},
    });
    const res = await request(app).get('/api/vmix/inputs?function=callsheet');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({instance: 'Scherm-PC', inputs: [
      {key: '11111111-aaaa-bbbb-cccc-000000000001', number: 1, type: 'Capture', title: 'Camera 1', fields: []},
      {key: '22222222-aaaa-bbbb-cccc-000000000002', number: 2, type: 'GT', title: 'Callsheet.gtzip', fields: ['Titel.Text', 'Timer.Text']},
    ]});
    expect(bridge.requestsOf('vmix:inputs')).toEqual([{function: 'callsheet'}]);

    expect((await request(app).get('/api/vmix/inputs?function=onbekend')).status).toBe(400);
    await request(app).put('/api/settings/vmix-instances').send({instances: [{id: 'weg', name: 'Weg', url: 'http://127.0.0.1:1'}]});
    bridge.on('vmix:inputs', () => ({ok: false, error: 'unreachable'}));
    const down = await request(app).get('/api/vmix/inputs');
    expect(down.status).toBe(502);
    expect(down.text).not.toContain('127.0.0.1');
  });

  it('warns on a manual push when vMix has no such input or field', async () => {
    const previousPush = await inTestOrganization(() => getSetting(VMIX_CALLSHEET_PUSH_KEY));
    try {
      await request(app).put('/api/settings/vmix-instances').send({instances: [{id: 'stream-pc', name: 'Stream-PC', url: streamUrl}]});
      await request(app).put('/api/settings/vmix-callsheet-push').send({input: 'Callsheet', current: {titleField: 'Titel.Text'}});
      const unknownInput = await request(app).post('/api/vmix/callsheet/push');
      expect(unknownInput.status).toBe(200);
      expect(unknownInput.body.warnings).toEqual([expect.stringContaining('vMix heeft geen input "Callsheet"')]);

      await request(app).put('/api/settings/vmix-callsheet-push').send({input: 'Callsheet.gtzip', current: {titleField: 'Titel.Text', timerField: 'Tijd.Text'}});
      const unknownField = await request(app).post('/api/vmix/callsheet/push');
      expect(unknownField.body.warnings).toEqual(['Title "Callsheet.gtzip" heeft geen veld "Tijd.Text"']);

      // By number or key, with the right fields: no warnings
      await request(app).put('/api/settings/vmix-callsheet-push').send({input: '2', current: {titleField: 'Titel.Text', timerField: 'Timer.Text'}});
      expect((await request(app).post('/api/vmix/callsheet/push')).body.warnings).toEqual([]);
    } finally {
      await inTestOrganization(() => setSetting(VMIX_CALLSHEET_PUSH_KEY, previousPush as never));
    }
  });

  it('rejects invalid instances', async () => {
    const res = await request(app).put('/api/settings/vmix-instances').send({
      instances: [{name: 'Stream-PC', url: 'geen url'}],
      targets: {callsheet: 'bestaat-niet'},
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid vMix instances');
  });

  it('changes the first instance through the single URL endpoint', async () => {
    await request(app).put('/api/settings/vmix-instances').send({
      instances: [{id: 'stream-pc', name: 'Stream-PC', url: streamUrl}, {id: 'scherm-pc', name: 'Scherm-PC', url: schermUrl}],
    });
    await request(app).put('/api/settings/vmix-url').send({vmixWebUrl: 'http://10.0.0.99:8088'}).expect(200);
    const {body} = await request(app).get('/api/settings/vmix-instances');
    expect(body.instances.map((i: { url: string }) => i.url)).toEqual(['http://10.0.0.99:8088', schermUrl]);
  });
});
