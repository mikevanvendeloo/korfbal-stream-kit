import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as prismaSvc from '../services/prisma';
import {installSeasonMocks, SeasonMockState} from '../../test-helpers';
import {ACTIVE_SEASON_ID_KEY} from '../services/season';
import {getIO, SEASON_CHANGED_EVENT} from '../services/socket';

const prisma = (prismaSvc as any).prisma as any;

describe('Seasons API', () => {
  let state: SeasonMockState;
  const idOf = (startYear: number) => state.seasons.find((s) => s.startYear === startYear)!.id;

  beforeEach(() => {
    state = installSeasonMocks(prisma, {startYears: [2024, 2025, 2026], activeStartYear: 2025});
    state.counts.set(idOf(2025), {matches: 12, players: 30});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const seasonChangedEmits = (emit: ReturnType<typeof vi.spyOn>) =>
    emit.mock.calls.filter(([event]) => event === SEASON_CHANGED_EVENT).map(([, payload]) => payload);

  describe('GET /api/seasons', () => {
    it('lists seasons newest first with counts and the active flag', async () => {
      const res = await request(app).get('/api/seasons');

      expect(res.status).toBe(200);
      expect(res.body.map((s: any) => s.name)).toEqual(['2026/2027', '2025/2026', '2024/2025']);
      const active = res.body.find((s: any) => s.isActive);
      expect(active).toMatchObject({
        name: '2025/2026',
        startYear: 2025,
        matchCount: 12,
        playerCount: 30,
        startDate: '2025-06-30T22:00:00.000Z',
        endDate: '2026-06-30T21:59:59.999Z',
      });
      expect(res.body.filter((s: any) => s.isActive)).toHaveLength(1);
      expect(typeof active.createdAt).toBe('string');
    });
  });

  describe('GET /api/seasons/active', () => {
    it('returns the configured active season', async () => {
      const res = await request(app).get('/api/seasons/active');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({id: idOf(2025), name: '2025/2026', isActive: true, matchCount: 12});
    });

    it('falls back to the season containing today, creating it when missing', async () => {
      vi.useFakeTimers({now: new Date('2028-02-01T12:00:00Z'), toFake: ['Date']});
      state.settings.delete(ACTIVE_SEASON_ID_KEY);

      const res = await request(app).get('/api/seasons/active');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({name: '2027/2028', isActive: true, matchCount: 0, playerCount: 0});
      expect(state.seasons.some((s) => s.startYear === 2027)).toBe(true);
    });
  });

  describe('GET /api/seasons/suggest-next', () => {
    it('suggests the season after the newest one', async () => {
      const res = await request(app).get('/api/seasons/suggest-next');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({startYear: 2027, name: '2027/2028'});
    });

    it('suggests the season after the current one when none exist', async () => {
      vi.useFakeTimers({now: new Date('2026-09-27T12:00:00Z'), toFake: ['Date']});
      state.seasons.length = 0;
      const res = await request(app).get('/api/seasons/suggest-next');
      expect(res.body).toEqual({startYear: 2027, name: '2027/2028'});
    });
  });

  describe('POST /api/seasons', () => {
    it('creates a season without activating it by default', async () => {
      const res = await request(app).post('/api/seasons').send({name: '2027/2028'});

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({startYear: 2027, name: '2027/2028', isActive: false, matchCount: 0, playerCount: 0});
      expect(state.settings.get(ACTIVE_SEASON_ID_KEY)).toBe(idOf(2025));
    });

    it('activates the new season when requested and tells connected clients', async () => {
      const emit = vi.spyOn(getIO(), 'emit');
      const res = await request(app).post('/api/seasons').send({name: '2027/2028', activate: true});

      expect(res.status).toBe(201);
      expect(res.body.isActive).toBe(true);
      expect(state.settings.get(ACTIVE_SEASON_ID_KEY)).toBe(res.body.id);
      expect(seasonChangedEmits(emit)).toEqual([res.body]);
    });

    it('does not broadcast a season change when the new season is not activated', async () => {
      const emit = vi.spyOn(getIO(), 'emit');
      await request(app).post('/api/seasons').send({name: '2027/2028'});
      expect(seasonChangedEmits(emit)).toEqual([]);
    });

    it.each([{name: '2027/2029'}, {name: '2027-2028'}, {name: ''}, {}, {name: '2027/2028', activate: 'yes'}, {name: '1999/2000'}, {name: '2101/2102'}])(
      'returns 400 for invalid body %j',
      async (body) => {
        const res = await request(app).post('/api/seasons').send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
      },
    );

    it('returns 409 when the season already exists', async () => {
      const res = await request(app).post('/api/seasons').send({name: '2026/2027'});
      expect(res.status).toBe(409);
    });

    it('returns 409 when a concurrent create wins the race', async () => {
      prisma.season.create = vi.fn(async () => {
        throw Object.assign(new Error('Unique constraint failed'), {code: 'P2002'});
      });
      const res = await request(app).post('/api/seasons').send({name: '2030/2031'});
      expect(res.status).toBe(409);
    });
  });

  describe('PUT /api/seasons/active', () => {
    it('switches the active season and tells connected clients', async () => {
      const emit = vi.spyOn(getIO(), 'emit');
      const res = await request(app).put('/api/seasons/active').send({seasonId: idOf(2026)});

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({id: idOf(2026), isActive: true});
      expect(seasonChangedEmits(emit)).toEqual([res.body]);
      const list = await request(app).get('/api/seasons');
      expect(list.body.find((s: any) => s.isActive).id).toBe(idOf(2026));
    });

    it('returns 404 for an unknown season', async () => {
      const res = await request(app).put('/api/seasons/active').send({seasonId: 999});
      expect(res.status).toBe(404);
      expect(state.settings.get(ACTIVE_SEASON_ID_KEY)).toBe(idOf(2025));
    });

    it.each([{}, {seasonId: 'abc'}, {seasonId: 0}, {seasonId: 1.5}, {seasonId: 2147483648}])('returns 400 for invalid body %j', async (body) => {
      const res = await request(app).put('/api/seasons/active').send(body);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/seasons/:id', () => {
    it('deletes an empty, non-active season', async () => {
      const res = await request(app).delete(`/api/seasons/${idOf(2024)}`);
      expect(res.status).toBe(204);
      expect(state.seasons.map((s) => s.startYear)).toEqual([2025, 2026]);
    });

    it('refuses to delete the active season', async () => {
      state.counts.delete(idOf(2025));
      const res = await request(app).delete(`/api/seasons/${idOf(2025)}`);
      expect(res.status).toBe(409);
    });

    it.each([{matches: 1, players: 0}, {matches: 0, players: 1}])('refuses to delete a season with data %j', async (counts) => {
      state.counts.set(idOf(2024), counts);
      const res = await request(app).delete(`/api/seasons/${idOf(2024)}`);
      expect(res.status).toBe(409);
      expect(state.seasons).toHaveLength(3);
    });

    it('returns 404 for an unknown season and 400 for an invalid id', async () => {
      expect((await request(app).delete('/api/seasons/999')).status).toBe(404);
      expect((await request(app).delete('/api/seasons/abc')).status).toBe(400);
      expect((await request(app).delete('/api/seasons/99999999999')).status).toBe(400);
    });

    it('returns 409 when a match or player was added between the check and the delete', async () => {
      prisma.season.delete = vi.fn(async () => {
        throw Object.assign(new Error('Foreign key constraint failed'), {code: 'P2003'});
      });
      const res = await request(app).delete(`/api/seasons/${idOf(2024)}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Seizoen bevat nog wedstrijden of spelers');
    });
  });
});
