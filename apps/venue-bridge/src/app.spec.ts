import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import axios from 'axios';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createStatsApp} from './app';
import {config, setConfigForTests} from './config';
import {clearLiveStatsCache} from './services/liveStats';
import {clearStatusCache} from './services/connectionTest';
import {resetShareForTests, setMdbOpener, setShareTimings, setSmbProbe} from './services/mdbFile';
import {readCsv} from './services/testCsv';

const fixtures = path.join(__dirname, 'test-fixtures/stats');
const TABLE = 'Fortuna Koog Zaandijk_31_10_2026';
const app = createStatsApp();

describe('statistics routes', () => {
  let share: string;
  let copies: string;
  const original = {...config};

  const mockPage = () => vi.spyOn(axios, 'get').mockResolvedValue({data: new Uint8Array(fs.readFileSync(path.join(fixtures, 'tweede-scherm.html')))});

  beforeEach(() => {
    share = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-share-'));
    copies = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-copy-'));
    for (const team of ['1', '2']) {
      fs.mkdirSync(path.join(share, `F${team}`));
      fs.writeFileSync(path.join(share, `F${team}`, 'WEDSTRIJDEN.mdb'), `team ${team}`);
    }
    setConfigForTests({
      statsDir: share, copyDir: copies, mdbPath: 'F{team}/WEDSTRIJDEN.mdb', mdbEnabled: true, keepCopy: true,
      shareHost: null, pageUrl: 'http://10.12.0.63/tweede.html',
    });
    const csv = readCsv(`${TABLE}.csv`);
    const players = readCsv('spelersover.csv');
    // The file's text tells which team folder was read
    setMdbOpener((buffer) => ({
      getTableNames: () => [TABLE, 'DVO DOS46_01_11_2026', 'spelersover'],
      getTable: (name) => ({getData: () => (name === TABLE ? csv : name === 'spelersover' ? [{SPELERSNAAM: buffer.toString()}, ...players] : [])}),
    }));
    setShareTimings(3000, 5000);
    setSmbProbe(async () => ({ok: true, ms: 1}));
    resetShareForTests();
    clearLiveStatsCache();
    clearStatusCache();
  });

  afterEach(() => {
    setConfigForTests(original);
    setMdbOpener(null);
    setSmbProbe(null);
    resetShareForTests();
    fs.rmSync(share, {recursive: true, force: true});
    fs.rmSync(copies, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  describe('team', () => {
    it('reads the team folder of ?team= (default 1) and says which one', async () => {
      const one = await request(app).get('/players');
      expect(one.body[0].SPELERSNAAM).toBe('team 1');
      expect(one.headers['x-stats-team']).toBe('1');
      const two = await request(app).get('/players?team=2');
      expect(two.body[0].SPELERSNAAM).toBe('team 2');
      expect(two.headers['x-stats-team']).toBe('2');
      const players = await request(app).get(`/matches/${encodeURIComponent(TABLE)}/players?team=2`);
      expect(players.body.team).toEqual({value: '2'});
    });

    it('refuses a team that is not digits, so the path cannot be steered', async () => {
      for (const team of ['../x', '2/../../etc', 'abc', '123', '']) {
        expect((await request(app).get('/matches').query({team})).status, team).toBe(400);
      }
    });
  });

  describe('database routes', () => {
    it('lists the matches, derives players and answers the current match', async () => {
      const list = await request(app).get('/matches');
      expect(list.status).toBe(200);
      expect(list.body.map((m: {table: string}) => m.table)).toEqual(['DVO DOS46_01_11_2026', TABLE]);
      expect(list.headers['x-stats-source']).toBe('share');
      const players = await request(app).get(`/matches/${encodeURIComponent(TABLE)}/players`);
      expect(players.body.players.find((p: {name: string}) => p.name === 'Roos van Groen')).toMatchObject({team: 'home', afstand: '3/7'});
      const current = await request(app).get('/current/players');
      expect(current.status).toBe(200);
      expect(current.body[0]).toMatchObject({source: 'share', vak: null});
    });

    it('answers team statistics (one flat row per team, with the attack figures of the page) and top scorers', async () => {
      mockPage();
      const res = await request(app).get('/team-stats');
      expect(res.status, res.text).toBe(200);
      expect(res.body.map((r: {team: string}) => r.team)).toEqual(['home', 'away']);
      const home = res.body[0];
      expect(home).toMatchObject({teamName: 'Fortuna/Ruitenheer', source: 'share'});
      expect(home.afstandAttempts).toBeGreaterThan(0);
      expect(home.goalsDames).toBeGreaterThan(0);
      expect(home.attacks).toBe(73);
      expect(home.turnovers).toBe(46);
      const top = await request(app).get('/top-scorers');
      expect(top.status).toBe(200);
      expect(top.body[0]).toMatchObject({team: 'home', rank: 1, source: 'share'});
      expect(top.body.filter((r: {team: string}) => r.team === 'away').length).toBeGreaterThan(0);
    });

    it('leaves the attack figures empty when the page is not reachable', async () => {
      vi.spyOn(axios, 'get').mockRejectedValue(new Error('down'));
      const res = await request(app).get('/team-stats');
      expect(res.status).toBe(200);
      expect(res.body[0].attacks).toBeNull();
      expect(res.body[0].goalPct).not.toBeNull();
    });

    it('answers the analysis of the current match, the same answer for polls on one read of the file', async () => {
      const res = await request(app).get('/analysis');
      expect(res.status, res.text).toBe(200);
      expect(res.headers['x-stats-source']).toBe('share');
      expect(res.body).toMatchObject({teams: {own: 'Fortuna/Ruitenheer'}, score: {own: 27, opponent: 14}, source: 'share', clock: {half: 2}});
      // the same possessions as the page's attack figures
      expect(res.body.attacks.own.total).toMatchObject({attacks: 73, turnovers: 46});
      expect(res.body.vakken).toHaveLength(2);
      expect((await request(app).get('/analysis')).body).toEqual(res.body);
    });

    it('only reads listed match tables', async () => {
      expect((await request(app).get('/matches/spelersover/actions')).status).toBe(404);
      expect((await request(app).get('/matches/..%2F..%2Fetc/actions')).status).toBe(404);
    });

    it('refuses a path that leaves the share', async () => {
      setConfigForTests({mdbPath: '../secret.mdb'});
      expect((await request(app).get('/matches')).status).toBe(400);
      expect((await request(app).get('/analysis')).status).toBe(400);
    });

    it('answers 404 for an unknown route', async () => {
      expect((await request(app).get('/nope')).status).toBe(404);
    });
  });

  describe('page', () => {
    it('answers the page and its flat player rows', async () => {
      mockPage();
      const live = await request(app).get('/live');
      expect(live.body.home.score).toBe(27);
      const rows = await request(app).get('/live/players?team=away&vak=1');
      expect(rows.body.find((p: {name: string}) => p.name === 'Zoë Engel')).toMatchObject({team: 'away', vak: 1});
      expect((await request(app).get('/live/players?team=sideways')).status).toBe(400);
    });

    it('answers 502 when the page is unreachable', async () => {
      vi.spyOn(axios, 'get').mockRejectedValue(new Error('connect ECONNREFUSED 10.12.0.63:80'));
      const res = await request(app).get('/live');
      expect(res.status).toBe(502);
      expect(res.text).not.toContain('ECONNREFUSED');
    });
  });

  describe('without a usable database', () => {
    it('/current/players falls back to the page rows when the database cannot be read', async () => {
      fs.rmSync(path.join(share, 'F1'), {recursive: true});
      mockPage();
      const res = await request(app).get('/current/players');
      expect(res.status, res.text).toBe(200);
      expect(res.body[0]).toMatchObject({source: 'page', vak: 1});
      expect(res.headers['x-stats-source']).toBe('page');
      expect(res.headers['x-stats-database']).toBe('unreachable');
    });

    it('/matches answers one synthetic live entry and /matches/live/players the page players', async () => {
      fs.rmSync(path.join(share, 'F1'), {recursive: true});
      mockPage();
      const list = await request(app).get('/matches');
      expect(list.status).toBe(200);
      expect(list.body).toEqual([{table: 'live', home: 'Fortuna/Ruitenheer', away: 'KZ/Keukensale.com', date: '2026-10-31', source: 'page'}]);
      const players = await request(app).get('/matches/live/players');
      expect(players.body.source).toBe('page');
      expect(players.body.players.find((p: {name: string}) => p.name === 'Roos van Groen')).toMatchObject({team: 'home', afstand: '3/7'});
      // whole match: Roos Hom plays in vak 2 only, Nik van der Steen's vak 1 is the whole match
      expect(players.body.players.find((p: {name: string}) => p.name === 'Nik van der Steen')).toMatchObject({afstand: '6/32'});
    });

    it('/team-stats and /top-scorers fall back to the page totals and players', async () => {
      fs.rmSync(path.join(share, 'F1'), {recursive: true});
      mockPage();
      const stats = await request(app).get('/team-stats');
      expect(stats.status, stats.text).toBe(200);
      expect(stats.body[0]).toMatchObject({source: 'page', database: 'unreachable', afstandGoals: 19, afstandAttempts: 101, goalsDames: null});
      expect(stats.headers['x-stats-database']).toBe('unreachable');
      const top = await request(app).get('/top-scorers');
      expect(top.body[0]).toMatchObject({source: 'page', team: 'home', rank: 1});
      setConfigForTests({mdbEnabled: false});
      expect((await request(app).get('/team-stats')).headers['x-stats-database']).toBe('disabled');
    });

    it('/analysis needs the database: 503 when it is switched off, even with the page reachable', async () => {
      mockPage();
      setConfigForTests({mdbEnabled: false});
      const off = await request(app).get('/analysis');
      expect(off.status).toBe(503);
      expect(off.body).toEqual({error: 'De analyse heeft het statistiekenbestand nodig'});
    });

    it('/analysis answers 503 when the database cannot be read', async () => {
      fs.rmSync(path.join(share, 'F1'), {recursive: true});
      const res = await request(app).get('/analysis');
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('De analyse heeft het statistiekenbestand nodig');
    });

    it('/players and /matches/:table/actions answer 503 "Database niet beschikbaar"', async () => {
      fs.rmSync(path.join(share, 'F1'), {recursive: true});
      for (const url of ['/players', `/matches/${encodeURIComponent(TABLE)}/actions`]) {
        const res = await request(app).get(url);
        expect(res.status, url).toBe(503);
        expect(res.body.error).toBe('Database niet beschikbaar');
      }
    });

    it('answers 503 when the page is gone too', async () => {
      fs.rmSync(path.join(share, 'F1'), {recursive: true});
      vi.spyOn(axios, 'get').mockRejectedValue(new Error('down'));
      expect((await request(app).get('/current/players')).status).toBe(503);
      expect((await request(app).get('/matches')).status).toBe(503);
    });

    it('MDB_ENABLED=false never touches the file system and reports database "disabled"', async () => {
      setConfigForTests({mdbEnabled: false, statsDir: '', copyDir: '/nonexistent/copy'});
      mockPage();
      const touched = [
        vi.spyOn(fs.promises, 'realpath'), vi.spyOn(fs.promises, 'stat'), vi.spyOn(fs.promises, 'readFile'),
        vi.spyOn(fs.promises, 'access'), vi.spyOn(fs.promises, 'writeFile'), vi.spyOn(fs.promises, 'mkdir'),
        vi.spyOn(fs, 'readFileSync'), vi.spyOn(fs, 'statSync'),
      ];
      const probe = vi.fn(async () => ({ok: true, ms: 1}));
      setSmbProbe(probe);
      const status = await request(app).get('/status');
      expect(status.body.database).toBe('disabled');
      const current = await request(app).get('/current/players');
      expect(current.body[0]).toMatchObject({source: 'page'});
      expect(current.headers['x-stats-database']).toBe('disabled');
      const list = await request(app).get('/matches');
      expect(list.body[0]).toMatchObject({table: 'live', source: 'page'});
      expect((await request(app).get('/players')).status).toBe(503);
      expect((await request(app).get('/matches/live/players')).body.source).toBe('page');
      for (const spy of touched) expect(spy).not.toHaveBeenCalled();
      expect(probe).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('reports team, database and page as ok/failed only', async () => {
      // The page as a local file: no host is known, so no network probe
      fs.copyFileSync(path.join(fixtures, 'tweede-scherm.html'), path.join(share, 'F1', 'tweede.html'));
      setConfigForTests({pageUrl: 'F1/tweede.html'});
      const res = await request(app).get('/status?team=2');
      expect(res.status).toBe(200);
      expect(res.body.team).toEqual({value: '2'});
      expect(res.body.network).toBeNull(); // no share host known: no probe
      expect(res.body.database).toMatchObject({ok: true});
      expect(res.body.page).toMatchObject({ok: true});
    });
  });
});
