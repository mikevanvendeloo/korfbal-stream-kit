import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {config, setConfigForTests} from '../config';
import {venueConfig} from '../test-support/venueConfig';
import {ConfigCache} from './configCache';

describe('config cache', () => {
  let dir: string;
  let file: string;
  const original = {...config};

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-cache-'));
    file = path.join(dir, 'venue-bridge.json');
  });
  afterEach(() => {
    setConfigForTests(original);
    fs.rmSync(dir, {recursive: true, force: true});
  });

  it('applies a valid configuration live, fires a change event and writes the cache with mode 600', async () => {
    const cache = new ConfigCache(file);
    const onChange = vi.fn();
    cache.on('change', onChange);
    const next = venueConfig({stats: {pageUrl: 'http://10.0.0.6/t.html', mdbPath: 'F{team}/W.mdb', mdbEnabled: true, shareHost: 'pc', keepCopy: false}, version: 'v2'});

    expect(cache.apply(next)).toEqual({ok: true});
    await cache.flush();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(cache.state).toMatchObject({state: 'applied', source: 'api', version: 'v2'});
    expect(config).toMatchObject({pageUrl: 'http://10.0.0.6/t.html', mdbPath: 'F{team}/W.mdb', mdbEnabled: true, shareHost: 'pc', keepCopy: false});
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir)).toEqual(['venue-bridge.json']);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).config.version).toBe('v2');
  });

  it('refuses an invalid configuration, keeps the old one and says why', async () => {
    const cache = new ConfigCache(file);
    cache.apply(venueConfig({version: 'good'}));
    const result = cache.apply({...venueConfig(), stats: {pageUrl: null, mdbPath: '../x.mdb', mdbEnabled: true, shareHost: null, keepCopy: true}});
    await cache.flush();
    expect(result.ok).toBe(false);
    expect(cache.config?.version).toBe('good');
  });

  it('applies a valid cache file at start', () => {
    const first = new ConfigCache(file);
    first.apply(venueConfig({shotclock: {url: 'http://10.0.0.9:8080'}, version: 'cached'}));
    return first.flush().then(() => {
      const second = new ConfigCache(file);
      expect(second.loadFromFile()).toBe(true);
      expect(second.config?.shotclock.url).toBe('http://10.0.0.9:8080');
      expect(second.state.source).toBe('cache');
    });
  });

  it('starts without configuration on a corrupt or invalid cache file, until the API sends one', () => {
    fs.writeFileSync(file, '{not json');
    const cache = new ConfigCache(file);
    expect(cache.loadFromFile()).toBe(false);
    expect(cache.state.state).toBe('none');
    fs.writeFileSync(file, JSON.stringify({config: {version: 1}, receivedAt: 'x'}));
    expect(cache.loadFromFile()).toBe(false);
    expect(cache.config).toBeNull();
    expect(cache.apply(venueConfig())).toEqual({ok: true});
    expect(cache.state.state).toBe('applied');
  });

  it('has no configuration and no error when there is no cache file', () => {
    expect(new ConfigCache(file).loadFromFile()).toBe(false);
  });

  it('remembers the statistics team across a restart', async () => {
    const cache = new ConfigCache(file);
    cache.apply(venueConfig());
    cache.rememberTeam('2');
    await cache.flush();
    const again = new ConfigCache(file);
    again.loadFromFile();
    expect(again.statsTeam).toBe('2');
    expect(new ConfigCache(file).statsTeam).toBe('1');
  });
});
