import http from 'node:http';
import type {AddressInfo} from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {fetchPage} from './liveStats';

const page = fs.readFileSync(path.join(__dirname, '../test-fixtures/stats/tweede-scherm.html'));

describe('fetchPage', () => {
  let server: http.Server | null = null;
  afterEach(() => server?.close());
  const listen = async (handler: http.RequestListener) => {
    server = http.createServer(handler);
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  it('reads the page', async () => {
    const url = await listen((_req, res) => res.end(page));
    expect((await fetchPage(`${url}/tweede.html`)).home.score).toBe(27);
  });

  it('treats a redirect as unreachable and never follows it', async () => {
    let followed = false;
    const target = await listen((_req, res) => {
      followed = true;
      res.end(page);
    });
    const targetServer = server;
    server = null;
    const url = await listen((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', `${target}/intern`);
      res.end();
    });
    await expect(fetchPage(`${url}/tweede.html`)).rejects.toMatchObject({status: 502});
    expect(followed).toBe(false);
    targetServer?.close();
  });
});
