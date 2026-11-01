import http from 'node:http';
import type {AddressInfo} from 'node:net';
import request from 'supertest';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import app from '../main';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
import {createProductionScenario} from '../../test-scenarios';
import {runWithOrganization} from '../services/organizationContext';
import {clearSettingsCache, getSetting, setSetting} from '../services/appSettings';
import {createApiKey} from '../services/apiKeys';
import {clearStatsBridgeCache} from '../services/stats/statsBridge';
import {clearStatsTeamCache} from '../services/stats/statsTeam';
import {clearStatsStatusCache} from './stats';

const runDb = process.env.REQUIRE_DB === 'true';
const ORG = 'stats-a';
const OTHER = 'stats-b';
const asA = (r: request.Test) => r.set('X-Organization', ORG);
const asB = (r: request.Test) => r.set('X-Organization', OTHER);

type Seen = {url: string; token: string | undefined};

/** A stand-in for the statistics bridge: answers what the test sets and remembers what it was asked. */
function fakeBridge() {
  const seen: Seen[] = [];
  let respond: (url: URL, res: http.ServerResponse) => void = (_url, res) => res.end('{}');
  const server = http.createServer((req, res) => {
    seen.push({url: req.url ?? '', token: req.headers['x-bridge-token'] as string | undefined});
    res.setHeader('Content-Type', 'application/json');
    respond(new URL(req.url ?? '/', 'http://bridge'), res);
  });
  return {
    seen,
    answer: (fn: typeof respond) => { respond = fn; },
    start: () => new Promise<string>((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe.runIf(runDb)('statistics routes through the bridge (integration)', () => {
  let orgA: number;
  let orgB: number;
  let bridgeUrl: string;
  const bridge = fakeBridge();

  const configure = async (url: string | null, token: string | null = null, org = orgA) => {
    await runWithOrganization(org, () => setSetting('matchStats', {bridgeUrl: url}));
    await runWithOrganization(org, () => setSetting('matchStatsBridgeToken', token ?? ''));
    clearSettingsCache();
    clearStatsBridgeCache();
    clearStatsStatusCache();
    clearStatsTeamCache();
  };

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, ORG, 'Stats A');
    orgB = await ensureOrganization(prisma, OTHER, 'Stats B');
    bridgeUrl = await bridge.start();
  });

  afterAll(async () => {
    await bridge.stop();
    await prisma.organization.deleteMany({where: {slug: {in: [ORG, OTHER]}}});
  });

  beforeEach(async () => {
    bridge.seen.length = 0;
    bridge.answer((_url, res) => res.end(JSON.stringify({ok: true})));
    await configure(bridgeUrl, 'bridge-secret');
    await configure(null, null, orgB);
  });
  afterEach(() => clearStatsBridgeCache());

  it('forwards to the bridge with the token and the production team, and passes the X-Stats headers on', async () => {
    bridge.answer((_url, res) => {
      res.setHeader('X-Stats-Source', 'share');
      res.setHeader('X-Stats-Read-At', '2026-10-31T20:00:00.000Z');
      res.setHeader('X-Stats-Team', '1');
      res.end(JSON.stringify([{table: 'Fortuna Koog Zaandijk_31_10_2026', home: 'Fortuna', away: 'Koog Zaandijk', date: '2026-10-31'}]));
    });
    const res = await asA(request(app).get('/api/stats/matches'));
    expect(res.status, res.text).toBe(200);
    expect(res.body[0].table).toBe('Fortuna Koog Zaandijk_31_10_2026');
    expect(res.headers['x-stats-source']).toBe('share');
    expect(res.headers['x-stats-read-at']).toBe('2026-10-31T20:00:00.000Z');
    expect(res.headers['x-stats-team']).toBe('1; from=default');
    expect(bridge.seen[0]).toEqual({url: '/matches?team=1', token: 'bridge-secret'});
  });

  it('asks for the team of the active production and says so', async () => {
    await runWithOrganization(orgA, () => setSetting('productionTeamNames', ['Stats Team 2']));
    const show = await createProductionScenario(prisma, {active: true, organizationId: orgA, match: {homeTeamName: 'Stats Team 2', awayTeamName: 'Tegenstander 1'}});
    try {
      clearStatsTeamCache();
      bridge.answer((_url, res) => {
        res.setHeader('X-Stats-Team', '2');
        res.end(JSON.stringify({source: 'share', readAt: '2026-10-31T20:00:00.000Z', team: {value: '2'}, teams: {own: 'A', opponent: 'B'}, players: []}));
      });
      const res = await asA(request(app).get('/api/stats/matches/Some%20Match_31_10_2026/players'));
      expect(res.status, res.text).toBe(200);
      expect(bridge.seen[0].url).toBe('/matches/Some%20Match_31_10_2026/players?team=2');
      expect(res.body.team).toEqual({value: '2', from: 'production'});
      expect(res.headers['x-stats-team']).toBe('2; from=production');
    } finally {
      await show.cleanup();
    }
  });

  it('lets live/players keep its own team parameter (home or away) and vak', async () => {
    const res = await asA(request(app).get('/api/stats/live/players?team=away&vak=1'));
    expect(res.status).toBe(200);
    expect(bridge.seen[0].url).toBe('/live/players?team=away&vak=1');
    expect((await asA(request(app).get('/api/stats/live/players?team=sideways'))).status).toBe(400);
  });

  it('forwards team statistics and top scorers with the team of the production', async () => {
    bridge.answer((_url, res) => {
      res.setHeader('X-Stats-Source', 'share');
      res.end(JSON.stringify([{team: 'home', rank: 1, name: 'Nik van der Steen', goals: 6}]));
    });
    const stats = await asA(request(app).get('/api/stats/team-stats'));
    expect(stats.status, stats.text).toBe(200);
    const top = await asA(request(app).get('/api/stats/top-scorers'));
    expect(top.body[0].name).toBe('Nik van der Steen');
    expect(bridge.seen.map((s) => s.url)).toEqual(['/team-stats?team=1', '/top-scorers?team=1']);
  });

  it('shares one request for polls within a moment', async () => {
    await asA(request(app).get('/api/stats/live'));
    await asA(request(app).get('/api/stats/live'));
    await asA(request(app).get('/api/stats/live'));
    expect(bridge.seen).toHaveLength(1);
  });

  it('passes the bridge\'s own refusals on (not set up PC, database off) with their message', async () => {
    bridge.answer((_url, res) => {
      res.statusCode = 503;
      res.end(JSON.stringify({error: 'Database niet beschikbaar'}));
    });
    const res = await asA(request(app).get('/api/stats/players'));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({error: 'Database niet beschikbaar'});
  });

  describe('bridge offline', () => {
    it('answers 503 STATS_BRIDGE_OFFLINE when nothing listens', async () => {
      const dead = fakeBridge();
      const deadUrl = await dead.start();
      await dead.stop();
      await configure(deadUrl);
      const res = await asA(request(app).get('/api/stats/live'));
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({code: 'STATS_BRIDGE_OFFLINE', error: 'De statistics bridge is offline'});
    });

    it('treats a redirect as offline and never follows it', async () => {
      const target = fakeBridge();
      const targetUrl = await target.start();
      bridge.answer((_url, res) => {
        res.statusCode = 302;
        res.setHeader('Location', `${targetUrl}/intern`);
        res.end('{}');
      });
      const res = await asA(request(app).get('/api/stats/live'));
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('STATS_BRIDGE_OFFLINE');
      expect(target.seen).toHaveLength(0);
      await target.stop();
    });

    it('treats a page that is not the bridge\'s JSON (a proxy error) as offline', async () => {
      bridge.answer((_url, res) => {
        res.statusCode = 502;
        res.end('<html>Bad gateway</html>');
      });
      expect((await asA(request(app).get('/api/stats/matches'))).body.code).toBe('STATS_BRIDGE_OFFLINE');
    });

    it('answers 409 when the organization has no bridge', async () => {
      const res = await asB(request(app).get('/api/stats/live'));
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/niet ingesteld/);
    });

    it('shows a refused token as a setup problem without echoing it', async () => {
      bridge.answer((_url, res) => {
        res.statusCode = 401;
        res.end(JSON.stringify({error: 'Bridge-token ontbreekt of is ongeldig'}));
      });
      const res = await asA(request(app).get('/api/stats/live'));
      expect(res.status).toBe(502);
      expect(res.text).not.toContain('bridge-secret');
    });
  });

  describe('status', () => {
    it('answers {bridge: {ok, ms}} plus the bridge\'s own test, cached for a few seconds', async () => {
      bridge.answer((_url, res) => res.end(JSON.stringify({team: {value: '1'}, host: '10.12.0.63', network: {ok: true, ms: 3}, database: {ok: true, ms: 5}, page: {ok: true, ms: 40}})));
      const res = await asA(request(app).get('/api/stats/status'));
      expect(res.status, res.text).toBe(200);
      expect(res.body.bridge).toMatchObject({ok: true});
      expect(res.body).toMatchObject({network: {ok: true}, database: {ok: true}, page: {ok: true}, team: {value: '1', from: 'default'}});
      await asA(request(app).get('/api/stats/status'));
      expect(bridge.seen).toHaveLength(1);
    });

    it('is 200 with bridge.ok false when the bridge is offline', async () => {
      const dead = fakeBridge();
      const deadUrl = await dead.start();
      await dead.stop();
      await configure(deadUrl);
      const res = await asA(request(app).get('/api/stats/status'));
      expect(res.status).toBe(200);
      expect(res.body.bridge).toEqual({ok: false, ms: null});
    });
  });

  describe('settings', () => {
    it('never returns the token and keeps, replaces or clears it', async () => {
      const get = await asA(request(app).get('/api/settings/match-stats'));
      expect(get.body).toEqual({bridgeUrl, hasBridgeToken: true});
      expect(get.text).not.toContain('bridge-secret');
      // Absent: kept
      let put = await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl: `${bridgeUrl}/`});
      expect(put.body).toEqual({bridgeUrl, hasBridgeToken: true});
      expect(put.text).not.toContain('bridge-secret');
      // New: replaced and used
      put = await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl, bridgeToken: 'second'});
      expect(put.body.hasBridgeToken).toBe(true);
      await asA(request(app).get('/api/stats/live'));
      expect(bridge.seen.at(-1)?.token).toBe('second');
      // Null: removed
      put = await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl, bridgeToken: null});
      expect(put.body.hasBridgeToken).toBe(false);
    });

    it('drops the token when the bridge moves to another origin without a new token', async () => {
      const put = await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl: 'http://other-bridge:3340'});
      expect(put.status, put.text).toBe(200);
      expect(put.body.hasBridgeToken).toBe(false);
      const withNew = await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl: 'http://third-bridge:3340', bridgeToken: 'new'});
      expect(withNew.body.hasBridgeToken).toBe(true);
    });

    it('validates the address', async () => {
      for (const bridgeUrl of ['ftp://x', 'statistics-bridge:3340', 'http://user:pw@bridge:3340', 'http://bridge:3340/?key=1']) {
        expect((await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl})).status, bridgeUrl).toBe(400);
      }
      expect((await asA(request(app).put('/api/settings/match-stats')).send({bridgeUrl: null})).status).toBe(200);
    });

    it('keeps the token out of the settings backup', async () => {
      const res = await asA(request(app).get('/api/backup/settings/export'));
      expect(res.status).toBe(200);
      expect(res.text).not.toContain('bridge-secret');
      expect(res.body.some((s: {key: string}) => s.key === 'matchStatsBridgeToken')).toBe(false);
      await asA(request(app).post('/api/backup/settings/import')).send([{key: 'matchStatsBridgeToken', value: 'from-backup'}]);
      expect(await runWithOrganization(orgA, () => getSetting('matchStatsBridgeToken'))).toBe('bridge-secret');
    });
  });

  it('lets a feed use the API key', async () => {
    const key = await runWithOrganization(orgA, () => createApiKey('stats vMix'));
    const res = await request(app).get(`/api/stats/live?key=${key.key}`);
    expect(res.status, res.text).toBe(200);
    expect(bridge.seen[0].url).toBe('/live');
    expect(bridge.seen[0].url).not.toContain('key=');
  });
});
