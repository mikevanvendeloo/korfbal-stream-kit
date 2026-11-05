import request from 'supertest';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {VENUE_EVENTS} from '@korfbal-stream-kit/venue-protocol';
import app from '../main';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
import {createProductionScenario} from '../../test-scenarios';
import {runWithOrganization} from '../services/organizationContext';
import {setSetting} from '../services/appSettings';
import {createApiKey} from '../services/apiKeys';
import {clearStatsBridgeCache} from '../services/stats/statsBridge';
import {clearStatsTeamCache} from '../services/stats/statsTeam';
import {clearVenueData} from '../services/venueData';
import {clearStatsStatusCache} from './stats';
import {connectFakeBridge, createBridgeKey, type FakeBridge} from '../test-support/fakeBridge';

const runDb = process.env.REQUIRE_DB === 'true';
const ORG = 'stats-a';
const OTHER = 'stats-b';
const asA = (r: request.Test) => r.set('X-Organization', ORG);
const asB = (r: request.Test) => r.set('X-Organization', OTHER);

type Answer = {status?: number; headers?: Record<string, string>; body: unknown};

describe.runIf(runDb)('statistics routes through the venue-bridge (integration)', () => {
  let orgA: number;
  let bridge: FakeBridge | null = null;

  /** What the fake bridge answers to every statistics request. */
  const answer = (fn: (path: string) => Answer) => bridge?.on(VENUE_EVENTS.statsRequest, ({path}) => {
    const a = fn(path);
    return {status: a.status ?? 200, headers: a.headers ?? {}, body: a.body};
  });
  const asked = () => bridge?.requestsOf(VENUE_EVENTS.statsRequest).map((p) => p.path) ?? [];

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, ORG, 'Stats A');
    await ensureOrganization(prisma, OTHER, 'Stats B');
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [ORG, OTHER]}}});
  });

  beforeEach(async () => {
    clearStatsBridgeCache();
    clearStatsStatusCache();
    clearStatsTeamCache();
    bridge = await connectFakeBridge(await createBridgeKey(orgA));
    answer(() => ({body: {ok: true}}));
  });
  afterEach(() => {
    bridge?.close();
    bridge = null;
    clearVenueData();
    clearStatsBridgeCache();
  });

  it('asks the bridge with the production team and passes the X-Stats headers on', async () => {
    answer(() => ({
      headers: {'x-stats-source': 'share', 'x-stats-read-at': '2026-10-31T20:00:00.000Z', 'x-stats-team': '1', 'content-type': 'text/plain'},
      body: [{table: 'Fortuna Koog Zaandijk_31_10_2026', home: 'Fortuna', away: 'Koog Zaandijk', date: '2026-10-31'}],
    }));
    const res = await asA(request(app).get('/api/stats/matches'));
    expect(res.status, res.text).toBe(200);
    expect(res.body[0].table).toBe('Fortuna Koog Zaandijk_31_10_2026');
    expect(res.headers['x-stats-source']).toBe('share');
    expect(res.headers['x-stats-read-at']).toBe('2026-10-31T20:00:00.000Z');
    expect(res.headers['x-stats-team']).toBe('1; from=default');
    expect(res.headers['content-type']).toMatch(/json/);
    expect(asked()).toEqual(['/matches?team=1']);
  });

  it('asks for the team of the active production and says so', async () => {
    await runWithOrganization(orgA, () => setSetting('productionTeamNames', ['Stats Team 2']));
    const show = await createProductionScenario(prisma, {active: true, organizationId: orgA, match: {homeTeamName: 'Stats Team 2', awayTeamName: 'Tegenstander 1'}});
    try {
      clearStatsTeamCache();
      answer(() => ({headers: {'x-stats-team': '2'}, body: {source: 'share', readAt: '2026-10-31T20:00:00.000Z', team: {value: '2'}, teams: {own: 'A', opponent: 'B'}, players: []}}));
      const res = await asA(request(app).get('/api/stats/matches/Some%20Match_31_10_2026/players'));
      expect(res.status, res.text).toBe(200);
      expect(asked()[0]).toBe('/matches/Some%20Match_31_10_2026/players?team=2');
      expect(res.body.team).toEqual({value: '2', from: 'production'});
      expect(res.headers['x-stats-team']).toBe('2; from=production');
    } finally {
      await show.cleanup();
    }
  });

  it('lets live/players keep its own team parameter (home or away) and vak', async () => {
    const res = await asA(request(app).get('/api/stats/live/players?team=away&vak=1'));
    expect(res.status).toBe(200);
    expect(asked()[0]).toBe('/live/players?team=away&vak=1');
    expect((await asA(request(app).get('/api/stats/live/players?team=sideways'))).status).toBe(400);
  });

  it('asks for team statistics and top scorers with the team of the production', async () => {
    answer(() => ({headers: {'x-stats-source': 'share'}, body: [{team: 'home', rank: 1, name: 'Nik van der Steen', goals: 6}]}));
    const stats = await asA(request(app).get('/api/stats/team-stats'));
    expect(stats.status, stats.text).toBe(200);
    const top = await asA(request(app).get('/api/stats/top-scorers'));
    expect(top.body[0].name).toBe('Nik van der Steen');
    expect(asked()).toEqual(['/team-stats?team=1', '/top-scorers?team=1']);
  });

  it('asks for the match analysis and passes the bridge\'s refusal on', async () => {
    answer(() => ({headers: {'x-stats-source': 'share'}, body: {score: {own: 27, opponent: 14}, vakken: []}}));
    const ok = await asA(request(app).get('/api/stats/analysis'));
    expect(ok.status, ok.text).toBe(200);
    expect(ok.body.score).toEqual({own: 27, opponent: 14});
    answer(() => ({status: 503, body: {error: 'De analyse heeft het statistiekenbestand nodig'}}));
    clearStatsBridgeCache();
    const off = await asA(request(app).get('/api/stats/analysis'));
    expect(off.status).toBe(503);
    expect(off.body).toEqual({error: 'De analyse heeft het statistiekenbestand nodig'});
  });

  it('shares one request for polls within a moment', async () => {
    await asA(request(app).get('/api/stats/live'));
    await asA(request(app).get('/api/stats/live'));
    await asA(request(app).get('/api/stats/live'));
    expect(asked()).toHaveLength(1);
  });

  it('passes the bridge\'s own refusals on with their message', async () => {
    answer(() => ({status: 503, body: {error: 'Database niet beschikbaar'}}));
    const res = await asA(request(app).get('/api/stats/players'));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({error: 'Database niet beschikbaar'});
  });

  describe('bridge offline', () => {
    it('answers 503 VENUE_BRIDGE_OFFLINE for an organization without a connected bridge', async () => {
      const res = await asB(request(app).get('/api/stats/live'));
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({code: 'VENUE_BRIDGE_OFFLINE', error: 'De venue-bridge is offline'});
    });

    it('answers 503 VENUE_BRIDGE_OFFLINE when the bridge does not answer within 5 s', async () => {
      bridge?.on(VENUE_EVENTS.statsRequest, () => new Promise(() => undefined));
      const started = Date.now();
      const res = await asA(request(app).get('/api/stats/live'));
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('VENUE_BRIDGE_OFFLINE');
      expect(Date.now() - started).toBeGreaterThanOrEqual(4900);
    }, 15_000);

    it('treats an answer that is not a statistics answer as offline', async () => {
      bridge?.on(VENUE_EVENTS.statsRequest, () => 'nonsense');
      expect((await asA(request(app).get('/api/stats/matches'))).body.code).toBe('VENUE_BRIDGE_OFFLINE');
    });

    it('treats an error status without the bridge\'s JSON error as offline', async () => {
      answer(() => ({status: 502, body: '<html>Bad gateway</html>'}));
      expect((await asA(request(app).get('/api/stats/matches'))).body.code).toBe('VENUE_BRIDGE_OFFLINE');
    });
  });

  describe('status', () => {
    it('answers {bridge: {ok, ms}} plus the bridge\'s own test, cached for a few seconds', async () => {
      answer(() => ({body: {team: {value: '1'}, host: '10.12.0.63', network: {ok: true, ms: 3}, database: {ok: true, ms: 5}, page: {ok: true, ms: 40}}}));
      const res = await asA(request(app).get('/api/stats/status'));
      expect(res.status, res.text).toBe(200);
      expect(res.body.bridge).toMatchObject({ok: true});
      expect(res.body).toMatchObject({network: {ok: true}, database: {ok: true}, page: {ok: true}, team: {value: '1', from: 'default'}});
      await asA(request(app).get('/api/stats/status'));
      expect(asked()).toHaveLength(1);
    });

    it('is 200 with bridge.ok false when there is no bridge', async () => {
      const res = await asB(request(app).get('/api/stats/status'));
      expect(res.status).toBe(200);
      expect(res.body.bridge).toEqual({ok: false, ms: null});
    });
  });

  it('lets a feed use the API key, without the key in what the bridge is asked', async () => {
    const key = await runWithOrganization(orgA, () => createApiKey('stats vMix'));
    const res = await request(app).get(`/api/stats/live?key=${key.key}`);
    expect(res.status, res.text).toBe(200);
    expect(asked()[0]).toBe('/live');
  });
});
