import request from 'supertest';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {VENUE_EVENTS, type ActionRow} from '@korfbal-stream-kit/venue-protocol';
import app from '../main';
import {ensureOrganization, testDb as prisma, withoutOrganization} from '../../test-helpers';
import {createProductionScenario} from '../../test-scenarios';
import {runWithOrganization} from '../services/organizationContext';
import {getActiveSeason} from '../services/season';
import {clearStatsBridgeCache} from '../services/stats/statsBridge';
import {clearStatsTeamCache} from '../services/stats/statsTeam';
import {clearStatsSync, syncStatsMatches} from '../services/stats/statsSync';
import {seasonStart} from '../services/stats/season';
import {clearVenueData} from '../services/venueData';
import {connectFakeBridge, createBridgeKey, type FakeBridge} from '../test-support/fakeBridge';

const runDb = process.env.REQUIRE_DB === 'true';
const ORG = 'season-a';
const OTHER = 'season-b';
const asA = (r: request.Test) => r.set('X-Organization', ORG);
const asB = (r: request.Test) => r.set('X-Organization', OTHER);

/** A small match: definition and lineup rows, then the actions. Own players A1..A4 (vak 1), B1..B4 (vak 2). */
let nr = 1;
const row = (aktnummer: number, opstelling: string | null, speler: string | null, tegenstander: string | null, t: number, omschrijving: string | null = null, optelveld = 1): ActionRow =>
  ({aktienummer: nr++, speler, tegenstander, aktieomschrijving: omschrijving, opstelling, doelpuntenvoor: 0, doelpuntentegen: 0, tijdtotaal: t, aktnummer, optelveld, absoluut: null});
function match(own: string, opponent: string, actions: ActionRow[]): ActionRow[] {
  nr = 1;
  return [
    row(8000, 'PLOEG', own, opponent, 0, '99902', 0),
    ...['A1', 'A2', 'A3', 'A4'].map((p, i) => row(0, 'AANVAL', p, `T${i + 1}`, 0, null, 0)),
    ...['B1', 'B2', 'B3', 'B4'].map((p, i) => row(0, 'VERDEDIGING', p, `U${i + 1}`, 0, null, 0)),
    row(4300, 'AANVAL', null, null, 0, 'START WEDSTRIJD'),
    ...actions,
  ];
}
const shot = (t: number, who: string, goal = false) => row(goal ? 3001 : 2001, 'AANVAL', who, 'T1', t, goal ? 'AFSTAND SCHOT GOAL' : 'AFSTAND SCHOT');
const turnover = (t: number) => row(2021, 'AANVAL', 'A1', 'T1', t, 'BAL OVER -');
const theirs = (t: number) => row(2950, 'VERDEDIGING', 'B1', 'U1', t, 'Pass');

/** dd_mm_yyyy for a table name, `days` after the given ISO date. */
const tableDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return {iso: d.toISOString().slice(0, 10), name: `${String(d.getUTCDate()).padStart(2, '0')}_${String(d.getUTCMonth() + 1).padStart(2, '0')}_${d.getUTCFullYear()}`};
};

describe.runIf(runDb)('season statistics: keeping matches and the season overview (integration)', () => {
  let orgA: number;
  let bridge: FakeBridge | null = null;
  let from: string;
  /** What the fake database holds: table -> rows; and the source header of the answers. */
  let tables: Record<string, ActionRow[]> = {};
  let source = 'share';

  const fingerprint = (rows: ActionRow[]) => ({actionCount: rows.filter((r) => r.optelveld !== 0 && r.aktnummer !== 0).length, lastActionAt: Math.max(0, ...rows.map((r) => r.tijdtotaal))});
  const rowsAsked = () => (bridge?.requestsOf(VENUE_EVENTS.statsRequest) ?? []).map((p) => (p as {path: string}).path).filter((p) => p.includes('/rows'));
  const sync = () => runWithOrganization(orgA, () => syncStatsMatches());
  /** Queries on organization A's stored matches (testDb adds the test organization outside a context). */
  const inA = <T>(fn: () => Promise<T>) => runWithOrganization(orgA, fn);

  beforeAll(async () => {
    orgA = await ensureOrganization(prisma, ORG, 'Fortuna');
    await ensureOrganization(prisma, OTHER, 'Andere club');
    from = seasonStart(await getActiveSeason());
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [ORG, OTHER]}}});
  });

  beforeEach(async () => {
    clearStatsBridgeCache();
    clearStatsTeamCache();
    clearStatsSync();
    await inA(() => prisma.statsMatch.deleteMany());
    source = 'share';
    bridge = await connectFakeBridge(await createBridgeKey(orgA));
    bridge.on(VENUE_EVENTS.statsRequest, ({path}: {path: string}) => {
      const headers = {'x-stats-source': source, 'x-stats-read-at': new Date().toISOString(), 'x-stats-team': '1', 'content-type': 'application/json'};
      const url = new URL(path, 'http://bridge.local');
      if (url.pathname === '/matches') {
        return {status: 200, headers, body: Object.entries(tables).map(([table, rows]) => ({table, home: 'x', away: 'y', date: null, ...fingerprint(rows)}))};
      }
      const m = url.pathname.match(/^\/matches\/(.+)\/rows$/);
      if (m && tables[decodeURIComponent(m[1])]) return {status: 200, headers, body: tables[decodeURIComponent(m[1])]};
      return {status: 404, headers, body: {error: 'Niet gevonden'}};
    });
  });
  afterEach(() => {
    bridge?.close();
    bridge = null;
    clearVenueData();
    clearStatsBridgeCache();
  });

  it('keeps the own team\'s match and skips other teams and other clubs', async () => {
    const d = tableDate(from, 7);
    tables = {
      [`Fortuna DOS46_${d.name}`]: match('Fortuna/Ruitenheer', 'DOS 46/VDK Groep', [shot(10, 'A1', true), theirs(20), turnover(30), theirs(40)]),
      [`DVO2 Fortuna2_${d.name}`]: match('DVO/Transus', 'Fortuna/Ruitenheer', [shot(10, 'A1', true)]),
      [`DVO DOS46_${d.name}`]: match('DVO/Transus', 'DOS 46/VDK Groep', [shot(10, 'A1', true)]),
    };
    expect(await sync()).toMatchObject({database: 'ok', stored: 1});
    const stored = await inA(() => prisma.statsMatch.findMany());
    expect(stored.map((s) => s.tableName)).toEqual([`Fortuna DOS46_${d.name}`]);
    expect(stored[0]).toMatchObject({team: 1, ownTeam: 'Fortuna/Ruitenheer', opponentTeam: 'DOS 46/VDK Groep'});
    expect((stored[0].rows as unknown[]).length).toBe(tables[`Fortuna DOS46_${d.name}`].length);
    // Another team of the own club is never fetched; another club's table is fetched once and remembered
    expect(rowsAsked().some((p) => p.includes('Fortuna2'))).toBe(false);
    expect(rowsAsked().filter((p) => p.includes('DVO%20DOS46'))).toHaveLength(1);

    await sync();
    expect(rowsAsked()).toHaveLength(2); // nothing changed: no table fetched again
  });

  it('fetches a table again only when its rows changed', async () => {
    const d = tableDate(from, 7);
    const table = `Fortuna KZ_${d.name}`;
    tables = {[table]: match('Fortuna/Ruitenheer', 'KZ/Keukensale.com', [shot(10, 'A1', true), theirs(20)])};
    await sync();
    tables[table] = [...tables[table], shot(30, 'A2', true), theirs(40)];
    clearStatsBridgeCache();
    await sync();
    expect(rowsAsked()).toHaveLength(2);
    const stored = await inA(() => prisma.statsMatch.findFirstOrThrow({where: {tableName: table}}));
    expect((stored.figures as {analysis: {score: {own: number}}}).analysis.score.own).toBe(2);
  });

  it('stores nothing from the statistics page', async () => {
    const d = tableDate(from, 7);
    tables = {[`Fortuna KZ_${d.name}`]: match('Fortuna/Ruitenheer', 'KZ', [shot(10, 'A1', true)])};
    source = 'page';
    expect(await sync()).toMatchObject({database: 'unavailable', stored: 0});
    expect(await inA(() => prisma.statsMatch.count())).toBe(0);
  });

  it('gives the season overview from the stored matches, also with the bridge offline', async () => {
    const d1 = tableDate(from, 7);
    const d2 = tableDate(from, 14);
    const before = tableDate(from, -1);
    tables = {
      [`Fortuna DOS46_${d1.name}`]: match('Fortuna/Ruitenheer', 'DOS 46/VDK Groep', [shot(10, 'A1', true), theirs(20), shot(30, 'A2'), shot(31, 'A2'), turnover(32), theirs(40)]),
      [`Fortuna KZ_${d2.name}`]: match('Fortuna/Ruitenheer', 'KZ/Keukensale.com', [shot(10, 'A1', true), theirs(20), turnover(30), theirs(40)]),
      [`Fortuna DVO_${before.name}`]: match('Fortuna/Ruitenheer', 'DVO/Transus', [shot(10, 'A3', true), theirs(20)]),
    };
    await sync();
    bridge?.close();
    bridge = null;
    clearVenueData();

    const res = await asA(request(app).get('/api/stats/season'));
    expect(res.status, res.text).toBe(200);
    expect(res.body.database).toBe('offline');
    expect(res.body.season.from).toBe(from);
    expect(res.body.matches.map((m: {date: string}) => m.date)).toEqual([d2.iso, d1.iso]);
    expect(res.body.matches[1]).toMatchObject({opponent: 'DOS 46/VDK Groep', score: {own: 1, opponent: 0}, attacks: 2, withoutAttempt: 0});
    expect(res.body.topScorers[0]).toMatchObject({rank: 1, name: 'A1', goals: 2, attempts: 2, goalPct: 100, matches: 2});
    expect(res.body.topScorers.find((p: {name: string}) => p.name === 'A3')).toBeUndefined();
    expect(res.body.totals.own).toMatchObject({matches: 2, goals: 2, attacks: 4, withGoal: 2, withoutAttempt: 1});
    expect(res.body.totals.own.byAttempts.reduce((s: number, n: number) => s + n, 0)).toBe(4);

    const flat = await asA(request(app).get('/api/stats/season/top-scorers?limit=1'));
    expect(flat.body).toEqual([{rank: 1, name: 'A1', goals: 2, attempts: 2, goalPct: '100%', matches: 2}]);
    expect((await asA(request(app).get('/api/stats/season/top-scorers?limit=0'))).status).toBe(400);
  });

  it('derives stored matches again after a change of the derivation', async () => {
    const d = tableDate(from, 7);
    tables = {[`Fortuna DOS46_${d.name}`]: match('Fortuna/Ruitenheer', 'DOS 46/VDK Groep', [shot(10, 'A1', true), theirs(20)])};
    await sync();
    await inA(() => prisma.statsMatch.updateMany({data: {derivationVersion: 0, figures: {}}}));
    const res = await asA(request(app).get('/api/stats/season'));
    expect(res.status, res.text).toBe(200);
    expect(res.body.topScorers[0]).toMatchObject({name: 'A1', goals: 1});
    expect((await inA(() => prisma.statsMatch.findFirstOrThrow())).derivationVersion).toBeGreaterThan(0);
  });

  it('syncs the database of a production that is switched off once more, for its own team', async () => {
    await createProductionScenario(prisma, {organizationId: orgA, active: true, match: {homeTeamName: 'Fortuna/Ruitenheer 2', awayTeamName: 'DVO 2'}});
    const next = await createProductionScenario(prisma, {organizationId: orgA, match: {homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'KZ 1'}});
    clearStatsTeamCache();
    const d = tableDate(from, 7);
    tables = {[`DVO2 Fortuna2_${d.name}`]: match('Fortuna/Ruitenheer', 'DVO/Transus', [shot(10, 'A1', true), theirs(20)])};

    const res = await asA(request(app).post(`/api/production/${next.productionId}/activate`));
    expect(res.status, res.text).toBe(200);
    await vi.waitFor(async () => expect(await inA(() => prisma.statsMatch.count({where: {team: 2}}))).toBe(1));
    const paths = (bridge?.requestsOf(VENUE_EVENTS.statsRequest) ?? []).map((p) => (p as {path: string}).path);
    expect(paths).toContain('/matches?team=2');
  });

  it('"Nu bijwerken" syncs the active team and every team with kept matches, or one team', async () => {
    const d = tableDate(from, 7);
    // A team 2 match was kept before (its production was active then)
    tables = {[`DVO2 Fortuna2_${d.name}`]: match('Fortuna/Ruitenheer', 'DVO/Transus', [shot(10, 'A1', true), theirs(20)])};
    await runWithOrganization(orgA, () => syncStatsMatches({value: '2', from: 'production'}));
    tables[`DVO2 Fortuna2_${d.name}`] = [...tables[`DVO2 Fortuna2_${d.name}`], shot(30, 'A2', true), theirs(40)];
    clearStatsBridgeCache();

    const all = await asA(request(app).post('/api/stats/season/sync'));
    expect(all.status, all.text).toBe(200);
    expect(all.body.results.map((r: {team: number; database: string}) => [r.team, r.database])).toEqual([[1, 'ok'], [2, 'ok']]);
    expect(all.body.results[1].stored).toBe(1);
    const kept = await inA(() => prisma.statsMatch.findFirstOrThrow({where: {team: 2}}));
    expect((kept.figures as {analysis: {score: {own: number}}}).analysis.score.own).toBe(2);

    const one = await asA(request(app).post('/api/stats/season/sync?team=2'));
    expect(one.body.results.map((r: {team: number}) => r.team)).toEqual([2]);
    expect((await asA(request(app).post('/api/stats/season/sync?team=0'))).status).toBe(400);
    expect((await asA(request(app).get('/api/stats/season'))).body.teams).toEqual([1, 2]);
    expect((await withoutOrganization(request(app).post('/api/stats/season/sync'))).status).toBe(401);
  });

  it('keeps the organizations apart and needs a key or an organization', async () => {
    const d = tableDate(from, 7);
    tables = {[`Fortuna DOS46_${d.name}`]: match('Fortuna/Ruitenheer', 'DOS 46/VDK Groep', [shot(10, 'A1', true), theirs(20)])};
    await sync();
    const other = await asB(request(app).get('/api/stats/season'));
    expect(other.status).toBe(200);
    expect(other.body.matches).toEqual([]);
    expect(other.body.topScorers).toEqual([]);
    expect(other.body.totals.own.attacks).toBe(0);
    expect((await withoutOrganization(request(app).get('/api/stats/season'))).status).toBe(401);
    expect((await withoutOrganization(request(app).get('/api/stats/season/top-scorers'))).status).toBe(401);
  });
});
