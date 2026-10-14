import request from 'supertest';
import http from 'node:http';
import {AddressInfo} from 'node:net';
import app from '../main';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {getSetting, setSetting, VMIX_URL_KEY} from '../services/appSettings';
import {VMIX_INSTANCES_KEY} from '../services/vmixInstances';

const runDb = process.env.REQUIRE_DB === 'true';

/** A stand-in for one vMix PC that remembers the function calls it got. */
function fakeVmix() {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url ?? '');
    res.end('<vmix/>');
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
    previous = {instances: await getSetting(VMIX_INSTANCES_KEY), url: await getSetting(VMIX_URL_KEY)};
    [streamUrl, schermUrl] = await Promise.all([stream.start(), scherm.start()]);
  });

  beforeEach(() => {
    stream.calls.length = 0;
    scherm.calls.length = 0;
  });

  afterAll(async () => {
    await setSetting(VMIX_INSTANCES_KEY, previous.instances as never);
    await setSetting(VMIX_URL_KEY, previous.url as never);
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
    expect(scherm.calls).toEqual(['/api?Function=SetCountdown&Value=00%3A30']);
    expect(stream.calls).toEqual([]);

    await request(app).post('/api/vmix/set-timer').send({seconds: 10, instanceId: 'stream-pc'}).expect(200);
    expect(stream.calls).toEqual(['/api?Function=SetCountdown&Value=00%3A10']);

    const unknown = await request(app).post('/api/vmix/set-timer').send({seconds: 10, instanceId: 'weg'});
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe('vMix instance "weg" is not configured');
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
