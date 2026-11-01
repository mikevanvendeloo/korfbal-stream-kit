import net from 'node:net';
import {afterEach, describe, expect, it} from 'vitest';
import {shareHostOf, smbReachable} from './connectionTest';

describe('statistics PC connection test', () => {
  let server: net.Server | null = null;
  afterEach(() => server?.close());

  it('reaches a listening port and reports a closed one as not reachable', async () => {
    server = net.createServer((s) => s.end());
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    expect(await smbReachable('127.0.0.1', port)).toMatchObject({ok: true});
    server.close();
    await new Promise((resolve) => server?.once('close', resolve));
    server = null;
    expect(await smbReachable('127.0.0.1', port)).toEqual({ok: false, ms: null});
  });

  it('gives up after the timeout on a host that does not answer', async () => {
    // 10.255.255.1 is not routed: the connect never completes
    const started = Date.now();
    expect(await smbReachable('10.255.255.1', 445, 300)).toEqual({ok: false, ms: null});
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('takes the share host from the setting, else from an http page URL', () => {
    expect(shareHostOf({shareHost: '10.12.0.63', pageUrl: 'http://10.0.0.1/'})).toBe('10.12.0.63');
    expect(shareHostOf({shareHost: null, pageUrl: 'http://10.12.0.63/scherm'})).toBe('10.12.0.63');
    expect(shareHostOf({shareHost: null, pageUrl: 'test/tweede-scherm.html'})).toBeNull();
    expect(shareHostOf({shareHost: null, pageUrl: null})).toBeNull();
  });
});
