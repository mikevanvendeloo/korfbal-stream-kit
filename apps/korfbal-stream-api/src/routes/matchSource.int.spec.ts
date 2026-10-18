import request from 'supertest';
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import app from '../main';
import {logger} from '../utils/logger';
import {getActiveSeason} from '../services/season';
import {MATCH_SOURCE_TIMEOUT} from '../services/matchSchedule/VrijwilligersMatchScheduleProvider';
import {recordingServer, refusedUrl} from '../test-support/recordingServer';
import {inTestOrganization, TEST_ORGANIZATION_SLUG, testDb as prisma} from '../../test-helpers';

/**
 * Match import against a local recording server standing in for the source: the date format the
 * source gets, the connection test, the error categories and the "Zaalcompetitie" preset.
 */
const runDb = process.env.REQUIRE_DB === 'true';
const TOKEN = 'imp-token-5e6f7a8b9c';
const EXTERNAL_IDS = ['imp-1', 'imp-2'];

const put = (baseUrl: string) => request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl, apiToken: TOKEN, isEnabled: true});
const importMatches = (date?: string) => request(app).post(`/api/match/matches/schedule/import${date === undefined ? '' : `?date=${encodeURIComponent(date)}`}`);
const testConnection = () => request(app).post('/api/match-source/test');

function item(id: string) {
  return {id, date: '2026-11-07T18:00:00.000Z', homeTeamName: 'Imp Thuis', awayTeamName: 'Imp Uit', isHomeMatch: true};
}

/** Captures the logger, so the expected warnings stay out of the test output and can be checked. */
function captureLogs() {
  const lines: {level: string; text: string}[] = [];
  const spies = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
    vi.spyOn(logger, level).mockImplementation(((...args: unknown[]) => void lines.push({level, text: JSON.stringify(args)})) as never));
  return {lines, all: () => lines.map((l) => l.text).join('\n'), restore: () => spies.forEach((s) => s.mockRestore())};
}

describe.runIf(runDb)('match import against the source (integration)', () => {
  let activeSeasonId: number;
  let activeStartYear: number;

  beforeAll(async () => {
    const season = await getActiveSeason();
    activeSeasonId = season.id;
    activeStartYear = season.startYear;
  });

  afterEach(() => {
    MATCH_SOURCE_TIMEOUT.ms = 10_000;
  });

  afterAll(async () => {
    await inTestOrganization(() => prisma.matchSchedule.deleteMany({where: {externalId: {in: EXTERNAL_IDS}}}));
    await prisma.matchSource.deleteMany({});
    await prisma.season.update({where: {id: activeSeasonId}, data: {indoorStartDate: null}});
  });

  describe('the date the source gets', () => {
    it.each([
      ['08-02-2026', '08-02-2026'],
      ['2026-02-08', '08-02-2026'],
      ['30-weeks', '30-weeks'],
    ])('sends %s as date=%s', async (date, upstreamDate) => {
      const upstream = await recordingServer({status: 200, body: '[]'});
      try {
        await put(upstream.url);
        const res = await importMatches(date);
        expect(res.status, res.text).toBe(200);
        expect(upstream.dates()).toEqual([upstreamDate]);
      } finally {
        await upstream.close();
      }
    });

    it('imports 30 weeks by default', async () => {
      const upstream = await recordingServer({status: 200, body: '[]'});
      try {
        await put(upstream.url);
        expect((await importMatches()).status).toBe(200);
        expect(upstream.dates()).toEqual(['30-weeks']);
      } finally {
        await upstream.close();
      }
    });

    it.each(['31-02-2026', '2026-02-08T10:00:00Z', '8-months', '1-days', 'gisteren'])('refuses %s with INVALID_DATE without calling the source', async (date) => {
      const upstream = await recordingServer({status: 200, body: '[]'});
      try {
        await put(upstream.url);
        const res = await importMatches(date);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ok: false, code: 'INVALID_DATE', hint: expect.stringContaining('DD-MM-JJJJ')});
        expect(upstream.urls).toEqual([]);
      } finally {
        await upstream.close();
      }
    });
  });

  describe('the connection test', () => {
    it('asks for the coming week and says how many matches the source has', async () => {
      const upstream = await recordingServer({status: 200, body: JSON.stringify([item('t-1'), item('t-2'), item('t-3')])});
      try {
        await put(upstream.url);
        const res = await testConnection();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ok: true, matches: 3});
        expect(upstream.dates()).toEqual(['1-weeks']);
        expect(upstream.requests[0].authorization).toBe(`Bearer ${TOKEN}`);
      } finally {
        await upstream.close();
      }
    });
  });

  describe('error categories', () => {
    const json = (status: number) => ({status, body: JSON.stringify({statusCode: status, message: 'x'})});
    it.each([
      [json(401), 502, 'SOURCE_UNAUTHORIZED', 'Token ongeldig of verlopen'],
      [json(403), 502, 'SOURCE_UNAUTHORIZED', 'Token ongeldig of verlopen'],
      [json(404), 502, 'SOURCE_NOT_FOUND', 'URL klopt niet'],
      [json(500), 502, 'SOURCE_SERVER_ERROR', 'De wedstrijdbron gaf een serverfout'],
      [{status: 200, body: '<!doctype html><html><body>Welkom</body></html>', contentType: 'text/html'}, 502, 'SOURCE_INVALID_RESPONSE', 'De wedstrijdbron gaf een onverwacht antwoord'],
      [{status: 200, body: JSON.stringify({statusCode: 500, message: 'Internal server error'})}, 502, 'SOURCE_INVALID_RESPONSE', 'De wedstrijdbron gaf een onverwacht antwoord'],
    ])('maps %j to %s %s', async (answer, status, code, error) => {
      const upstream = await recordingServer(answer);
      const logs = captureLogs();
      try {
        await put(upstream.url);
        for (const res of [await testConnection(), await importMatches('08-02-2026')]) {
          expect(res.status).toBe(status);
          expect(res.body).toEqual({ok: false, code, error, hint: expect.any(String)});
        }
      } finally {
        logs.restore();
        await upstream.close();
      }
    });

    it('reports SOURCE_TIMEOUT when the source does not answer in time', async () => {
      MATCH_SOURCE_TIMEOUT.ms = 300;
      const upstream = await recordingServer({status: 200, body: '', hang: true});
      const logs = captureLogs();
      try {
        await put(upstream.url);
        const res = await testConnection();
        expect(res.status).toBe(504);
        expect(res.body).toMatchObject({ok: false, code: 'SOURCE_TIMEOUT'});
        expect(logs.all()).toMatch(/"axiosCode":"(ECONNABORTED|ETIMEDOUT)"/);
      } finally {
        logs.restore();
        await upstream.close();
      }
    });

    it('reports SOURCE_UNREACHABLE when the connection is refused', async () => {
      const logs = captureLogs();
      try {
        await put(await refusedUrl());
        const res = await testConnection();
        expect(res.status).toBe(502);
        expect(res.body).toMatchObject({ok: false, code: 'SOURCE_UNREACHABLE', error: 'De wedstrijdbron is niet bereikbaar'});
        expect(logs.all()).toContain('"axiosCode":"ECONNREFUSED"');
      } finally {
        logs.restore();
      }
    });

    it('reports SOURCE_NOT_CONFIGURED with 409 when the import is switched off', async () => {
      await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: 'https://wedstrijden.example/v1', isEnabled: false});
      const res = await testConnection();
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ok: false, code: 'SOURCE_NOT_CONFIGURED', hint: expect.any(String)});
    });
  });

  describe('server log', () => {
    it('logs the request URL without the token, and a failure with its details but without the token', async () => {
      const upstream = await recordingServer((req) => ({status: 500, body: JSON.stringify({error: 'kapot', echo: req.headers.authorization})}));
      const logs = captureLogs();
      try {
        await put(upstream.url);
        await importMatches('08-02-2026');
        const requestLog = logs.lines.find((l) => l.level === 'info' && l.text.includes('Match source request'));
        expect(requestLog?.text).toContain('date=08-02-2026');
        const failure = logs.lines.find((l) => l.level === 'warn' && l.text.includes('Match source request failed'));
        expect(failure).toBeDefined();
        const meta = JSON.parse(failure?.text ?? '[]')[1];
        expect(meta).toMatchObject({
          organization: TEST_ORGANIZATION_SLUG, provider: 'vrijwilligers', category: 'SOURCE_SERVER_ERROR',
          upstreamStatus: 500, axiosCode: 'ERR_BAD_RESPONSE', durationMs: expect.any(Number),
        });
        expect(meta.body).toContain('kapot');
        expect(logs.all()).not.toContain(TOKEN);
      } finally {
        logs.restore();
        await upstream.close();
      }
    });

    it('logs the counts of a successful import', async () => {
      const upstream = await recordingServer({status: 200, body: JSON.stringify(EXTERNAL_IDS.map(item))});
      const logs = captureLogs();
      try {
        await put(upstream.url);
        const res = await importMatches('07-11-2026');
        expect(res.status, res.text).toBe(200);
        expect(res.body).toMatchObject({ok: true, total: 2});
        const done = logs.lines.find((l) => l.text.includes('Program import done'));
        expect(JSON.parse(done?.text ?? '[]')[1]).toMatchObject({fetched: 2, created: res.body.inserted, updated: res.body.updated});
      } finally {
        logs.restore();
        await upstream.close();
      }
    });
  });

  describe('Zaalcompetitie: from the indoor start date of the active season', () => {
    it('round-trips the start date of a season (DD-MM-YYYY in, ISO out, null clears)', async () => {
      const res = await request(app).put(`/api/seasons/${activeSeasonId}`).send({indoorStartDate: `07-11-${activeStartYear}`});
      expect(res.status, res.text).toBe(200);
      expect(res.body.indoorStartDate).toBe(`${activeStartYear}-11-07`);
      expect((await request(app).get('/api/seasons/active')).body.indoorStartDate).toBe(`${activeStartYear}-11-07`);
      const list = await request(app).get('/api/seasons');
      expect(list.body.find((s: {id: number}) => s.id === activeSeasonId).indoorStartDate).toBe(`${activeStartYear}-11-07`);

      const cleared = await request(app).put(`/api/seasons/${activeSeasonId}`).send({indoorStartDate: null});
      expect(cleared.body.indoorStartDate).toBeNull();
    });

    it('refuses a start date outside the season, an impossible date or other fields', async () => {
      for (const body of [{indoorStartDate: `07-11-${activeStartYear + 1}`}, {indoorStartDate: `31-02-${activeStartYear + 1}`}, {indoorStartDate: 'morgen'}, {indoorStartDate: null, name: 'x'}]) {
        const res = await request(app).put(`/api/seasons/${activeSeasonId}`).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error).toEqual(expect.any(String));
      }
      expect((await request(app).put('/api/seasons/2147483647').send({indoorStartDate: null})).status).toBe(404);
    });

    it('refuses a cross-site change of the start date', async () => {
      const res = await request(app).put(`/api/seasons/${activeSeasonId}`).set('Origin', 'https://evil.example').send({indoorStartDate: `07-11-${activeStartYear}`});
      expect(res.status).toBe(403);
      expect((await prisma.season.findUniqueOrThrow({where: {id: activeSeasonId}})).indoorStartDate).toBeNull();
    });

    it('sends the start date to the source as DD-MM-YYYY for date=indoor', async () => {
      await request(app).put(`/api/seasons/${activeSeasonId}`).send({indoorStartDate: `07-11-${activeStartYear}`});
      const upstream = await recordingServer({status: 200, body: '[]'});
      try {
        await put(upstream.url);
        const res = await importMatches('indoor');
        expect(res.status, res.text).toBe(200);
        expect(upstream.dates()).toEqual([`07-11-${activeStartYear}`]);
        expect(res.body.date).toBe(`${activeStartYear}-11-07`);
      } finally {
        await upstream.close();
        await request(app).put(`/api/seasons/${activeSeasonId}`).send({indoorStartDate: null});
      }
    });

    it('answers INVALID_DATE with a clear message when the start date is not set', async () => {
      const upstream = await recordingServer({status: 200, body: '[]'});
      try {
        await put(upstream.url);
        const res = await importMatches('indoor');
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ok: false, code: 'INVALID_DATE', hint: 'Stel de startdatum van de zaalcompetitie in bij Seizoenen (Instellingen → Seizoen).'});
        expect(res.body.error).toContain('startdatum van de zaalcompetitie is niet ingesteld');
        expect(upstream.urls).toEqual([]);
      } finally {
        await upstream.close();
      }
    });
  });
});

describe.runIf(runDb)('match source hardening (integration)', () => {
  afterAll(async () => {
    await prisma.matchSource.deleteMany({});
  });

  it('does not follow a redirect (it could lead past the https rule to an internal address)', async () => {
    const internal = await recordingServer({status: 200, body: '[]'});
    const redirecting = await recordingServer({status: 302, body: '', headers: {location: `${internal.url}/programs`}});
    const logs = captureLogs();
    try {
      await put(redirecting.url);
      const res = await testConnection();
      expect(res.body).toMatchObject({ok: false, code: 'SOURCE_INVALID_RESPONSE'});
      expect(redirecting.urls).toHaveLength(1);
      expect(internal.urls).toEqual([]);
    } finally {
      logs.restore();
      await Promise.all([internal.close(), redirecting.close()]);
    }
  });

  it('refuses a URL with a user name or password (it would end up in the logs)', async () => {
    const res = await request(app).put('/api/match-source')
      .send({provider: 'vrijwilligers', baseUrl: 'https://user:geheim@wedstrijden.example/v1', apiToken: TOKEN});
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('geheim');
  });

  it('keeps the token out of the log also when the source echoes it escaped, encoded or in other case', async () => {
    const odd = 'Tok"en\\/+ä9';
    const upstream = await recordingServer(() => ({
      status: 500,
      body: JSON.stringify({json: odd, url: `x?t=${encodeURIComponent(odd)}`, upper: odd.toUpperCase()}),
    }));
    const logs = captureLogs();
    try {
      await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: upstream.url, apiToken: odd, isEnabled: true});
      await importMatches('08-02-2026');
      const all = logs.all();
      expect(all).toContain('[token]');
      for (const form of [odd, JSON.stringify(odd).slice(1, -1), encodeURIComponent(odd), odd.toUpperCase()]) {
        expect(all).not.toContain(form);
        expect(all).not.toContain(JSON.stringify(form).slice(1, -1));
      }
    } finally {
      logs.restore();
      await upstream.close();
    }
  });

  it('does not log referee names from the source (privacy, and no forged log lines)', async () => {
    const upstream = await recordingServer({status: 200, body: JSON.stringify([
      {...item('hard-1'), refereeProviderName: 'Geheime Scheids\nFORGED line (Scheidsrechter)'},
    ])});
    const logs = captureLogs();
    try {
      await put(upstream.url);
      expect((await importMatches('08-02-2026')).status).toBe(200);
      expect(logs.all()).not.toContain('Geheime Scheids');
    } finally {
      logs.restore();
      await upstream.close();
      await inTestOrganization(() => prisma.matchSchedule.deleteMany({where: {externalId: 'hard-1'}}));
    }
  });
});
