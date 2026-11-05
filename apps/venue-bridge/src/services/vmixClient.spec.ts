import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {buildVmixFunctionUrl, parseVmixInputs, resolveVmixInstance, VmixClient} from './vmixClient';

const XML = `<vmix><inputs>
<input key="abc" number="1" type="GT" title="Lower &amp; Third.gtzip"><text name="Titel.Text">x</text><text name="Sub.Text"/></input>
<input key="def" number="2" type="Colour" title="Kleur"/>
</inputs></vmix>`;

describe('vmix helpers', () => {
  it('builds percent-encoded function URLs', () => {
    expect(buildVmixFunctionUrl('http://h:8088/api', {Function: 'SetText', Value: 'Eerste helft'})).toBe('http://h:8088/api/?Function=SetText&Value=Eerste%20helft');
  });

  it('parses the inputs XML', () => {
    expect(parseVmixInputs(XML)).toEqual([
      {key: 'abc', number: 1, type: 'GT', title: 'Lower & Third.gtzip', fields: ['Titel.Text', 'Sub.Text']},
      {key: 'def', number: 2, type: 'Colour', title: 'Kleur', fields: []},
    ]);
  });

  it('resolves the instance per function, a named one, the first one or an error', () => {
    const vmix = {instances: [{id: 'a', name: 'A', url: 'http://a'}, {id: 'b', name: 'B', url: 'http://b'}], targets: {countdown: 'b', callsheet: ''}};
    expect(resolveVmixInstance(vmix, 'countdown')).toMatchObject({instance: {id: 'b'}});
    expect(resolveVmixInstance(vmix, 'callsheet')).toMatchObject({instance: {id: 'a'}});
    expect(resolveVmixInstance(vmix, 'callsheet', 'b')).toMatchObject({instance: {id: 'b'}});
    expect(resolveVmixInstance(vmix, 'callsheet', 'zz')).toEqual({error: 'vMix instance "zz" is not configured'});
    expect(resolveVmixInstance(undefined, 'callsheet')).toEqual({error: 'vMix Web URL is not configured'});
  });
});

describe('vmix client', () => {
  let server: http.Server;
  let urls: string[];
  let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  let client: VmixClient;

  beforeEach(async () => {
    urls = [];
    handler = (_req, res) => res.end('ok');
    server = http.createServer((req, res) => {
      urls.push(req.url ?? '');
      handler(req, res);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    client = new VmixClient(() => ({instances: [{id: 'main', name: 'Main', url: base}], targets: {countdown: 'main', callsheet: ''}}));
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });

  it('calls SetCountdown on the countdown instance', async () => {
    expect(await client.call({function: 'countdown', commands: [{Function: 'SetCountdown', Value: '00:30'}]})).toEqual({ok: true});
    expect(urls).toEqual(['/api/?Function=SetCountdown&Value=00%3A30']);
    expect(client.state('main')?.ok).toBe(true);
  });

  it('sends a batch of SetText in order', async () => {
    const commands = ['a', 'b', 'c'].map((v) => ({Function: 'SetText', Input: 'T', SelectedName: 'X.Text', Value: v}));
    expect(await client.call({function: 'callsheet', commands})).toEqual({ok: true});
    expect(urls.map((u) => new URL(u, 'http://x').searchParams.get('Value'))).toEqual(['a', 'b', 'c']);
  });

  it('reads the inputs', async () => {
    handler = (_req, res) => res.end(XML);
    const answer = await client.inputs({function: 'callsheet'});
    expect(answer).toMatchObject({ok: true, instance: 'Main'});
    expect(answer.ok && answer.inputs).toHaveLength(2);
  });

  it('answers invalid for an answer that is no vMix state', async () => {
    handler = (_req, res) => res.end('<html/>');
    expect(await client.inputs({function: 'callsheet'})).toEqual({ok: false, error: 'invalid'});
  });

  it('answers unreachable without the address, and stops the batch at the first failure', async () => {
    const down = new VmixClient(() => ({instances: [{id: 'x', name: 'X', url: 'http://127.0.0.1:1'}], targets: {countdown: '', callsheet: ''}}));
    const answer = await down.call({function: 'callsheet', commands: [{Function: 'A'}, {Function: 'B'}]});
    expect(answer).toEqual({ok: false, error: 'unreachable'});
    expect(JSON.stringify(answer)).not.toContain('127.0.0.1');
    expect(await down.inputs({function: 'callsheet'})).toEqual({ok: false, error: 'unreachable'});
    expect(down.state('x')?.ok).toBe(false);
  });

  it('answers unreachable at the 1.5 s deadline', async () => {
    handler = (_req, res) => void setTimeout(() => res.end('ok'), 4000).unref();
    const started = Date.now();
    expect(await client.call({function: 'callsheet', commands: [{Function: 'A'}]})).toEqual({ok: false, error: 'unreachable'});
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('answers a configuration error without a configured instance', async () => {
    const none = new VmixClient(() => undefined);
    expect(await none.call({function: 'callsheet', commands: [{Function: 'A'}]})).toEqual({ok: false, error: 'vMix Web URL is not configured'});
  });
});
