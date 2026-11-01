import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import axios from 'axios';
import app from '../main';
import {config, getAssetsRoot} from '../services/config';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
import {runWithOrganization} from '../services/organizationContext';
import {clearSettingsCache, setSetting} from '../services/appSettings';
import {createApiKey} from '../services/apiKeys';
import {clearLiveStatsCache} from '../services/stats/liveStats';
import {clearMdbCache, setMdbOpener} from '../services/stats/mdbFile';
import {readCsv} from '../services/stats/testCsv';

const runDb = process.env.REQUIRE_DB === 'true';
const fixtures = path.join(__dirname, '../test-fixtures/stats');
const ORG = 'stats-a';
const OTHER = 'stats-b';
const TABLE = 'Fortuna Koog Zaandijk_31_10_2026';
const asA = (r: request.Test) => r.set('X-Organization', ORG);
const asB = (r: request.Test) => r.set('X-Organization', OTHER);

describe.runIf(runDb)('statistics routes (integration)', () => {
  let orgA: number;
  let orgB: number;
  let dir: string;
  const originalStatsDir = config.statsDir;

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, ORG, 'Stats A');
    orgB = await ensureOrganization(prisma, OTHER, 'Stats B');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-'));
    fs.mkdirSync(path.join(dir, 'F1'));
    fs.copyFileSync(path.join(fixtures, 'WEDSTRIJDEN.mdb'), path.join(dir, 'F1', 'WEDSTRIJDEN.mdb'));
    (config as {statsDir: string}).statsDir = dir;
    const csv = readCsv(`${TABLE}.csv`);
    const players = readCsv('spelersover.csv');
    setMdbOpener(() => ({
      getTableNames: () => [TABLE, 'DVO DOS46_01_11_2026', 'spelersover'],
      getTable: (name) => ({getData: () => (name === TABLE ? csv : name === 'spelersover' ? players : [])}),
    }));
  });

  afterAll(async () => {
    (config as {statsDir: string}).statsDir = originalStatsDir;
    setMdbOpener(null);
    fs.rmSync(dir, {recursive: true, force: true});
    fs.rmSync(path.join(getAssetsRoot(), 'stats', ORG), {recursive: true, force: true});
    await prisma.organization.deleteMany({where: {slug: {in: [ORG, OTHER]}}});
  });

  beforeEach(async () => {
    clearLiveStatsCache();
    clearMdbCache();
    await runWithOrganization(orgA, () => setSetting('matchStats', {pageUrl: 'http://10.12.0.63/tweede.html', mdbPath: 'F1/WEDSTRIJDEN.mdb'}));
    await runWithOrganization(orgB, () => setSetting('matchStats', {pageUrl: null, mdbPath: null}));
    clearSettingsCache();
  });
  afterEach(() => vi.restoreAllMocks());

  const mockPage = () =>
    vi.spyOn(axios, 'get').mockResolvedValue({data: new Uint8Array(fs.readFileSync(path.join(fixtures, 'tweede-scherm.html')))});

  it('answers the parsed page and fetches the stats PC once for several polls', async () => {
    const get = mockPage();
    const first = await asA(request(app).get('/api/stats/live'));
    expect(first.status, first.text).toBe(200);
    expect(first.body.home.score).toBe(27);
    expect(first.body.clock).toBe('00:55:11');
    await asA(request(app).get('/api/stats/live'));
    await asA(request(app).get('/api/stats/live/players?team=home'));
    expect(get).toHaveBeenCalledTimes(1);
    const url = get.mock.calls[0][0] as string;
    expect(url).toBe('http://10.12.0.63/tweede.html');
    expect(get.mock.calls[0][1]).toMatchObject({maxContentLength: expect.any(Number), signal: expect.anything()});
  });

  it('gives flat player rows for vMix', async () => {
    mockPage();
    const res = await asA(request(app).get('/api/stats/live/players?team=away&vak=1'));
    expect(res.status).toBe(200);
    const zoe = res.body.find((p: {name: string}) => p.name === 'Zoë Engel');
    expect(zoe).toMatchObject({team: 'away', vak: 1, afstandGoals: expect.any(Number), afstand: expect.stringMatching(/^\d+\/\d+$/)});
    expect((await asA(request(app).get('/api/stats/live/players?team=sideways'))).status).toBe(400);
  });

  it('answers 409 when not configured and 502 when the stats PC is unreachable', async () => {
    const none = await asB(request(app).get('/api/stats/live'));
    expect(none.status).toBe(409);
    expect(none.body.error).toMatch(/niet ingesteld/);
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('connect ECONNREFUSED 10.12.0.63:80'));
    const down = await asA(request(app).get('/api/stats/live'));
    expect(down.status).toBe(502);
    expect(down.text).not.toContain('ECONNREFUSED');
  });

  it('lists the match tables and derives per-player stats', async () => {
    const list = await asA(request(app).get('/api/stats/matches'));
    expect(list.status, list.text).toBe(200);
    expect(list.body.map((m: {table: string}) => m.table)).toEqual(['DVO DOS46_01_11_2026', TABLE]);
    const res = await asA(request(app).get(`/api/stats/matches/${encodeURIComponent(TABLE)}/players`));
    expect(res.status).toBe(200);
    const roos = res.body.players.find((p: {name: string}) => p.name === 'Roos van Groen');
    expect(roos).toMatchObject({team: 'home', afstand: '3/7', rebound: '1/1'});
    const actions = await asA(request(app).get(`/api/stats/matches/${encodeURIComponent(TABLE)}/actions`));
    expect(actions.status).toBe(200);
    expect(actions.body.length).toBeGreaterThan(100);
    const players = await asA(request(app).get('/api/stats/players'));
    expect(players.status).toBe(200);
    expect(players.body[0]).toHaveProperty('SPELERSNAAM');
  });

  it('only reads listed match tables', async () => {
    expect((await asA(request(app).get('/api/stats/matches/spelersover/actions'))).status).toBe(404);
    expect((await asA(request(app).get('/api/stats/matches/..%2F..%2Fetc/actions'))).status).toBe(404);
  });

  it('keeps organizations apart and answers 409 for an organization without a file', async () => {
    expect((await asB(request(app).get('/api/stats/matches'))).status).toBe(409);
  });

  it('refuses a path that leaves the share or is no Access file', async () => {
    for (const mdbPath of ['../secret.mdb', '/etc/passwd', 'F1/notes.txt']) {
      await runWithOrganization(orgA, () => setSetting('matchStats', {pageUrl: null, mdbPath}));
      clearSettingsCache();
      clearMdbCache();
      const res = await asA(request(app).get('/api/stats/matches'));
      expect(res.status, mdbPath).toBe(400);
    }
  });

  it('says where the data came from and falls back to the copy when the share is gone', async () => {
    const first = await asA(request(app).get('/api/stats/matches'));
    expect(first.headers['x-stats-source']).toBe('share');
    const copy = path.join(getAssetsRoot(), 'stats', ORG, 'WEDSTRIJDEN.mdb');
    expect(fs.existsSync(copy)).toBe(true);
    fs.renameSync(path.join(dir, 'F1'), path.join(dir, 'F1-weg'));
    try {
      clearMdbCache();
      const res = await asA(request(app).get('/api/stats/matches'));
      expect(res.status, res.text).toBe(200);
      expect(res.headers['x-stats-source']).toBe('copy');
      expect(res.headers['x-stats-read-at']).toBe(fs.statSync(copy).mtime.toISOString());
      const players = await asA(request(app).get(`/api/stats/matches/${encodeURIComponent(TABLE)}/players`));
      expect(players.body.source).toBe('copy');
    } finally {
      fs.renameSync(path.join(dir, 'F1-weg'), path.join(dir, 'F1'));
    }
  });

  it('current/players: newest match from the database, else the live page', async () => {
    const db = await asA(request(app).get('/api/stats/current/players'));
    expect(db.status, db.text).toBe(200);
    expect(db.body[0]).toMatchObject({source: 'share', vak: null});
    // No share and no copy: the page
    fs.rmSync(path.join(getAssetsRoot(), 'stats', ORG), {recursive: true, force: true});
    fs.renameSync(path.join(dir, 'F1'), path.join(dir, 'F1-weg'));
    try {
      clearMdbCache();
      mockPage();
      const page = await asA(request(app).get('/api/stats/current/players'));
      expect(page.status, page.text).toBe(200);
      expect(page.body[0]).toMatchObject({source: 'page', vak: 1, afstand: expect.stringMatching(/^\d+\/\d+$/)});
      expect(page.headers['x-stats-source']).toBe('page');
      vi.spyOn(axios, 'get').mockRejectedValue(new Error('down'));
      clearLiveStatsCache();
      expect((await asA(request(app).get('/api/stats/current/players'))).status).toBe(503);
    } finally {
      fs.renameSync(path.join(dir, 'F1-weg'), path.join(dir, 'F1'));
    }
  });

  it('reads the page from a local .html file inside STATS_DIR', async () => {
    fs.copyFileSync(path.join(fixtures, 'tweede-scherm.html'), path.join(dir, 'F1', 'tweede.html'));
    const get = vi.spyOn(axios, 'get');
    const ok = await asA(request(app).put('/api/settings/match-stats')).send({pageUrl: 'F1/tweede.html', mdbPath: null});
    expect(ok.status, ok.text).toBe(200);
    const res = await asA(request(app).get('/api/stats/live'));
    expect(res.status, res.text).toBe(200);
    expect(res.body.home.score).toBe(27);
    expect(get).not.toHaveBeenCalled();
    for (const pageUrl of ['../tweede.html', '/etc/x.html', 'F1/tweede.txt']) {
      expect((await asA(request(app).put('/api/settings/match-stats')).send({pageUrl, mdbPath: null})).status, pageUrl).toBe(400);
    }
  });

  it('validates the settings and lets a feed use the API key', async () => {
    const bad = await asA(request(app).put('/api/settings/match-stats')).send({pageUrl: 'ftp://x', mdbPath: null});
    expect(bad.status).toBe(400);
    const bad2 = await asA(request(app).put('/api/settings/match-stats')).send({pageUrl: null, mdbPath: '../x.mdb'});
    expect(bad2.status).toBe(400);
    const ok = await asA(request(app).put('/api/settings/match-stats')).send({pageUrl: 'http://10.12.0.63/tweede.html', mdbPath: 'F1/WEDSTRIJDEN.mdb'});
    expect(ok.status, ok.text).toBe(200);
    mockPage();
    const key = await runWithOrganization(orgA, () => createApiKey('stats vMix'));
    const res = await request(app).get(`/api/stats/live?key=${key.key}`);
    expect(res.status, res.text).toBe(200);
    expect(res.body.away.name).toBe('KZ/Keukensale.com');
  });
});
