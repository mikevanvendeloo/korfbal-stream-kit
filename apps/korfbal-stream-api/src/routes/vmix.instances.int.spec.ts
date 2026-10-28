import request from 'supertest';
import http from 'node:http';
import {AddressInfo} from 'node:net';
import app from '../main';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {getSetting, setSetting, VMIX_URL_KEY} from '../services/appSettings';
import {VMIX_INSTANCES_KEY} from '../services/vmixInstances';
import {VMIX_CALLSHEET_PUSH_KEY} from '../services/vmixCallsheetPush';
import {inTestOrganization} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

// What vMix answers to /api/ without a function: its state, with the inputs
const VMIX_STATE = `<vmix><version>28.0.0.39</version><inputs>
<input key="11111111-aaaa-bbbb-cccc-000000000001" number="1" type="Capture" title="Camera 1" state="Running">Camera 1</input>
<input key="22222222-aaaa-bbbb-cccc-000000000002" number="2" type="GT" title="Callsheet.gtzip" state="Paused">Callsheet.gtzip
<text index="0" name="Titel.Text">Opening</text>
<text index="1" name="Timer.Text">00:30</text>
</input>
</inputs></vmix>`;

/** A stand-in for one vMix PC that remembers the function calls it got. */
function fakeVmix() {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url ?? '');
    res.end(VMIX_STATE);
  });
  return {
    calls,
    server,
    start: () => new Promise<string>((resolve) => server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe.runIf(runDb)('vMix instances (integration)', () => {
  const stream = fakeVmix();
  const scherm = fakeVmix();
  let streamUrl = '';
  let schermUrl = '';
  let previous: { instances: unknown; url: unknown } = {instances: null, url: null};

  beforeAll(async () => {
    previous = {instances: await inTestOrganization(() => getSetting(VMIX_INSTANCES_KEY)), url: await inTestOrganization(() => getSetting(VMIX_URL_KEY))};
    [streamUrl, schermUrl] = await Promise.all([stream.start(), scherm.start()]);
  });

  beforeEach(() => {
    stream.calls.length = 0;
    scherm.calls.length = 0;
  });

  afterAll(async () => {
    await inTestOrganization(() => setSetting(VMIX_INSTANCES_KEY, previous.instances as never));
    await inTestOrganization(() => setSetting(VMIX_URL_KEY, previous.url as never));
    await Promise.all([stream.stop(), scherm.stop()]);
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
    expect(scherm.calls).toEqual(['/api/?Function=SetCountdown&Value=00%3A30']);
    expect(stream.calls).toEqual([]);

    await request(app).post('/api/vmix/set-timer').send({seconds: 10, instanceId: 'stream-pc'}).expect(200);
    expect(stream.calls).toEqual(['/api/?Function=SetCountdown&Value=00%3A10']);

    const unknown = await request(app).post('/api/vmix/set-timer').send({seconds: 10, instanceId: 'weg'});
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('vMix instance "weg" is not configured');
  });

  it('answers 502 without the vMix address when vMix is unreachable', async () => {
    await request(app).put('/api/settings/vmix-instances').send({
      instances: [{id: 'stream-pc', name: 'Stream-PC', url: 'http://127.0.0.1:1'}],
    });
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
    // One request for the XML state (axios drops the empty "?" of /api/?)
    expect(scherm.calls).toEqual(['/api/']);

    expect((await request(app).get('/api/vmix/inputs?function=onbekend')).status).toBe(400);
    await request(app).put('/api/settings/vmix-instances').send({instances: [{id: 'weg', name: 'Weg', url: 'http://127.0.0.1:1'}]});
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
