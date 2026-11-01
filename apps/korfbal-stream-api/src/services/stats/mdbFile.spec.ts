import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {config} from '../config';
import {runWithOrganization} from '../organizationContext';
import {clearMdbCache, listStatsMatches, readSharedFile, readStatsFile, resolveStatsFile, setMdbOpener, setShareTimings, HTML_EXTENSIONS} from './mdbFile';

vi.mock('../appSettings', () => ({getMatchStats: async () => ({pageUrl: null, mdbPath: 'F1/WEDSTRIJDEN.mdb'})}));

const mutable = config as {statsDir: string; assetsDir: string};
const inOrg = <T>(fn: () => Promise<T>) => runWithOrganization(7, fn, 'stats-unit');

describe('statistics file access', () => {
  let share: string;
  let assets: string;
  const original = {statsDir: config.statsDir, assetsDir: config.assetsDir};

  beforeEach(() => {
    share = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-share-'));
    assets = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-assets-'));
    fs.mkdirSync(path.join(share, 'F1'));
    fs.writeFileSync(path.join(share, 'F1', 'WEDSTRIJDEN.mdb'), 'first');
    fs.writeFileSync(path.join(share, 'F1', 'tweede.html'), '<html></html>');
    mutable.statsDir = share;
    mutable.assetsDir = assets;
    setShareTimings(3000, 5000);
    clearMdbCache();
  });
  afterEach(() => {
    Object.assign(mutable, original);
    fs.rmSync(share, {recursive: true, force: true});
    fs.rmSync(assets, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it('refuses paths outside the share and wrong extensions', async () => {
    fs.symlinkSync(os.tmpdir(), path.join(share, 'link'));
    for (const rel of ['../x.mdb', '/etc/passwd', 'C:\\x.mdb', 'F1/notes.txt', 'link/anything.mdb']) {
      await expect(resolveStatsFile(share, rel), rel).rejects.toMatchObject({status: expect.any(Number)});
    }
    await expect(resolveStatsFile(share, 'F1/WEDSTRIJDEN.mdb')).resolves.toContain('WEDSTRIJDEN.mdb');
    await expect(resolveStatsFile(share, 'F1/WEDSTRIJDEN.mdb', HTML_EXTENSIONS)).rejects.toMatchObject({status: 400});
    await expect(resolveStatsFile(share, 'F1/tweede.html', HTML_EXTENSIONS)).resolves.toContain('tweede.html');
  });

  it('keeps a local copy at <assets>/stats/<slug>/<file> after a read of the share', async () => {
    const read = await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
    expect(read.source).toBe('share');
    expect(fs.readFileSync(path.join(assets, 'stats', 'stats-unit', 'WEDSTRIJDEN.mdb'), 'utf8')).toBe('first');
    expect(fs.readdirSync(path.join(assets, 'stats', 'stats-unit'))).toEqual(['WEDSTRIJDEN.mdb']);
  });

  it('updates the local copy at most every 5 minutes', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    try {
      await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
      fs.writeFileSync(path.join(share, 'F1', 'WEDSTRIJDEN.mdb'), 'second');
      await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
      const copy = path.join(assets, 'stats', 'stats-unit', 'WEDSTRIJDEN.mdb');
      expect(fs.readFileSync(copy, 'utf8')).toBe('first');
      vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
      await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
      expect(fs.readFileSync(copy, 'utf8')).toBe('second');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the file on the share again only when it changed, and then at most every 10 seconds', async () => {
    const opened: string[] = [];
    setMdbOpener((buffer) => {
      opened.push(buffer.toString());
      return {getTableNames: () => [], getTable: () => ({getData: () => []})};
    });
    vi.useFakeTimers({toFake: ['Date']});
    try {
      const file = path.join(share, 'F1', 'WEDSTRIJDEN.mdb');
      await inOrg(() => listStatsMatches());
      vi.setSystemTime(Date.now() + 4000);
      await inOrg(() => listStatsMatches());
      expect(opened).toEqual(['first']);
      fs.writeFileSync(file, 'second');
      fs.utimesSync(file, new Date(), new Date(Date.now() + 1000));
      vi.setSystemTime(Date.now() + 4000);
      await inOrg(() => listStatsMatches());
      expect(opened).toEqual(['first']);
      vi.setSystemTime(Date.now() + 4000);
      await inOrg(() => listStatsMatches());
      expect(opened).toEqual(['first', 'second']);
    } finally {
      vi.useRealTimers();
      setMdbOpener(null);
    }
  });

  it('reads the copy when the share is gone, with the copy\'s mtime as readAt', async () => {
    await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
    fs.rmSync(path.join(share, 'F1'), {recursive: true});
    clearMdbCache();
    const read = await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
    expect(read.source).toBe('copy');
    expect(read.buffer.toString()).toBe('first');
    const mtime = fs.statSync(path.join(assets, 'stats', 'stats-unit', 'WEDSTRIJDEN.mdb')).mtime.toISOString();
    expect(read.readAt).toBe(mtime);
  });

  it('answers 503 when the share fails and there is no copy', async () => {
    fs.rmSync(path.join(share, 'F1'), {recursive: true});
    await expect(inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'))).rejects.toMatchObject({status: 503});
  });

  it('falls back to the copy when a share read hangs, and skips the share for a while', async () => {
    await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
    clearMdbCache();
    setShareTimings(50, 60_000);
    const realRealpath = fs.promises.realpath.bind(fs.promises);
    // Only the share hangs; the local copy stays readable
    const slow = vi.spyOn(fs.promises, 'realpath').mockImplementation(((p: fs.PathLike) =>
      String(p).includes('stats-assets-') ? realRealpath(p) : new Promise(() => undefined)) as typeof fs.promises.realpath);
    const started = Date.now();
    const read = await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'));
    expect(read.source).toBe('copy');
    expect(Date.now() - started).toBeLessThan(1000);
    const shareCalls = () => slow.mock.calls.filter(([p]) => !String(p).includes('stats-assets-')).length;
    const calls = shareCalls();
    // The failing share is remembered: the next read does not touch it
    expect((await inOrg(() => readStatsFile('F1/WEDSTRIJDEN.mdb'))).source).toBe('copy');
    expect(shareCalls()).toBe(calls);
  });

  it('reads a local html page through the same resolution', async () => {
    const buffer = await inOrg(() => readSharedFile('F1/tweede.html', HTML_EXTENSIONS));
    expect(buffer.toString()).toBe('<html></html>');
    await expect(inOrg(() => readSharedFile('../tweede.html', HTML_EXTENSIONS))).rejects.toMatchObject({status: 400});
  });
});
