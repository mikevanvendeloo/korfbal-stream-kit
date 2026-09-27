import request from 'supertest';
import app from '../main';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as prismaSvc from '../services/prisma';
import {installSeasonMocks, SeasonMockState} from '../../test-helpers';

const prisma = (prismaSvc as any).prisma as any;

describe('Season scoping of existing endpoints', () => {
  let state: SeasonMockState;
  const idOf = (startYear: number) => state.seasons.find((s) => s.startYear === startYear)!.id;

  beforeEach(() => {
    state = installSeasonMocks(prisma, {startYears: [2025, 2026], activeStartYear: 2026});
  });

  describe('manual matches', () => {
    beforeEach(() => {
      prisma.matchSchedule = {
        findMany: vi.fn(async () => []),
        create: vi.fn(async ({data}: any) => ({id: 1, ...data})),
        update: vi.fn(async ({where, data}: any) => ({id: where.id, ...data})),
      };
    });

    it('lists manual matches of the active season by default', async () => {
      await request(app).get('/api/manual-matches');
      expect(prisma.matchSchedule.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {isManual: true, seasonId: idOf(2026)},
      }));
    });

    it('lists manual matches of an explicit season', async () => {
      await request(app).get(`/api/manual-matches?seasonId=${idOf(2025)}`);
      expect(prisma.matchSchedule.findMany.mock.calls[0][0].where.seasonId).toBe(idOf(2025));
    });

    it('derives the season from the date on create and on update', async () => {
      const created = await request(app).post('/api/manual-matches').send({
        date: '2026-06-30T21:30:00.000Z', homeTeamName: 'A', awayTeamName: 'B',
      });
      const updated = await request(app).put('/api/manual-matches/1').send({
        date: '2026-06-30T22:30:00.000Z', homeTeamName: 'A', awayTeamName: 'B',
      });

      expect(created.status).toBe(201);
      expect(created.body.seasonId).toBe(idOf(2025));
      expect(updated.body.seasonId).toBe(idOf(2026));
    });

    it('auto-creates a missing season for a manual match far in the future', async () => {
      await request(app).post('/api/manual-matches').send({
        date: '2031-01-10T12:00:00.000Z', homeTeamName: 'A', awayTeamName: 'B',
      });
      expect(state.seasons.some((s) => s.name === '2030/2031')).toBe(true);
    });
  });

  describe('productions', () => {
    beforeEach(() => {
      prisma.production = {findMany: vi.fn(async () => [])};
      prisma.matchSchedule = {findMany: vi.fn(async () => [])};
    });

    it('GET /api/production filters on the match season', async () => {
      const res = await request(app).get('/api/production');
      expect(res.status).toBe(200);
      expect(prisma.production.findMany.mock.calls[0][0].where).toEqual({matchSchedule: {seasonId: idOf(2026)}});
    });

    it('GET /api/production accepts a seasonId override and rejects invalid ones', async () => {
      await request(app).get(`/api/production?seasonId=${idOf(2025)}`);
      expect(prisma.production.findMany.mock.calls[0][0].where).toEqual({matchSchedule: {seasonId: idOf(2025)}});
      expect((await request(app).get('/api/production?seasonId=x')).status).toBe(400);
      expect((await request(app).get('/api/production?seasonId=999')).status).toBe(404);
    });

    it('GET /api/production/dates lists production dates of the (explicit) season only', async () => {
      prisma.production.findMany = vi.fn(async () => [{matchSchedule: {date: new Date('2026-10-03T12:00:00Z')}}]);

      const res = await request(app).get('/api/production/dates');
      await request(app).get(`/api/production/dates?seasonId=${idOf(2025)}`);

      expect(res.body).toEqual(['2026-10-03']);
      expect(prisma.production.findMany.mock.calls[0][0].where).toEqual({matchSchedule: {seasonId: idOf(2026)}});
      expect(prisma.production.findMany.mock.calls[1][0].where).toEqual({matchSchedule: {seasonId: idOf(2025)}});
    });

    it('rejects a seasonId beyond the integer range with 400 instead of a database error', async () => {
      const res = await request(app).get('/api/production?seasonId=99999999999');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid seasonId');
      expect(prisma.production.findMany).not.toHaveBeenCalled();
    });

    it('GET /api/production/matches filters candidate matches on season', async () => {
      await request(app).get('/api/production/matches');
      expect(prisma.matchSchedule.findMany.mock.calls[0][0].where.seasonId).toBe(idOf(2026));
    });
  });

  describe('reports', () => {
    beforeEach(() => {
      prisma.production = {findMany: vi.fn(async () => [])};
    });

    it.each(['/api/reports/interviews', '/api/reports/crew-roles', '/api/reports/production-dates'])(
      '%s is scoped to the season',
      async (url) => {
        await request(app).get(`${url}?seasonId=${idOf(2025)}`);
        expect(prisma.production.findMany.mock.calls[0][0].where).toEqual({matchSchedule: {seasonId: idOf(2025)}});
      },
    );
  });

  describe('clubs teams', () => {
    it('GET /api/clubs/:id/teams only uses matches of the season', async () => {
      prisma.club = {findUnique: vi.fn(async () => ({name: 'Fortuna'}))};
      prisma.matchSchedule = {findMany: vi.fn(async () => [])};

      await request(app).get('/api/clubs/1/teams');

      for (const [args] of prisma.matchSchedule.findMany.mock.calls) {
        expect(args.where.seasonId).toBe(idOf(2026));
      }
      expect(prisma.matchSchedule.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('backup', () => {
    it('matches import always derives the season from the date, ignoring an exported season name', async () => {
      const stored: any[] = [];
      prisma.matchSchedule = {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({data}: any) => stored.push(data)),
      };

      const res = await request(app).post('/api/backup/matches/import').send([
        {externalId: 'a', date: '2026-10-01T10:00:00Z', homeTeamName: 'A', awayTeamName: 'B'},
        {externalId: 'b', date: '2026-10-01T10:00:00Z', homeTeamName: 'A', awayTeamName: 'B', seasonName: '2025/2026'},
        {date: '2024-10-01T10:00:00Z', homeTeamName: 'A', awayTeamName: 'B'},
      ]);

      expect(res.body).toMatchObject({ok: true, created: 3});
      expect(stored.map((m) => m.seasonId)).toEqual([idOf(2026), idOf(2026), state.seasons.find((s) => s.startYear === 2024)!.id]);
      // One season lookup per start year, not per row.
      expect(prisma.season.upsert).toHaveBeenCalledTimes(2);
    });

    it('matches export includes the season name', async () => {
      prisma.matchSchedule = {
        findMany: vi.fn(async () => [{externalId: 'a', date: new Date('2026-10-01T10:00:00Z'), season: {name: '2026/2027'}}]),
      };
      const res = await request(app).get('/api/backup/matches/export');
      expect(res.body[0].seasonName).toBe('2026/2027');
    });

    it('clubs import restores players into their exported season, or the active season for old backups', async () => {
      prisma.club = {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({data}: any) => ({id: 5, ...data})),
      };
      prisma.player = {
        upsert: vi.fn(async () => ({})),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({})),
        findMany: vi.fn(async () => []),
      };
      prisma.playerImage = {findMany: vi.fn(async () => [])};

      const res = await request(app).post('/api/backup/clubs/import').send([
        {
          name: 'Fortuna', slug: 'fortuna', players: [
            {name: 'Old', externalId: 'x1', seasonName: '2025/2026'},
            {name: 'Old too', externalId: 'x3', seasonName: '2025/2026'},
            {name: 'Legacy', externalId: 'x2'},
            {name: 'NoExt'},
          ],
        },
      ]);

      expect(res.body).toMatchObject({ok: true, created: 1});
      // Season lookups are memoized per start year instead of an upsert per player row.
      expect(prisma.season.upsert).toHaveBeenCalledTimes(1);
      // Restored legacy photoUrls are migrated right after the import.
      expect(prisma.player.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {photoUrl: {startsWith: 'players/'}},
      }));
      expect(prisma.player.upsert.mock.calls[0][0].where).toEqual({seasonId_externalId: {seasonId: idOf(2025), externalId: 'x1'}});
      expect(prisma.player.upsert.mock.calls[1][0].where).toEqual({seasonId_externalId: {seasonId: idOf(2025), externalId: 'x3'}});
      expect(prisma.player.upsert.mock.calls[2][0].where).toEqual({seasonId_externalId: {seasonId: idOf(2026), externalId: 'x2'}});
      expect(prisma.player.findFirst.mock.calls[0][0].where).toEqual({seasonId: idOf(2026), clubId: 5, name: 'NoExt'});
      expect(prisma.player.create.mock.calls[0][0].data.seasonId).toBe(idOf(2026));
    });

    it('clubs export includes the season name of each player', async () => {
      prisma.club = {
        findMany: vi.fn(async () => [{name: 'F', shortName: 'F', slug: 'f', logoUrl: null, players: [{name: 'P', season: {name: '2025/2026'}}]}]),
      };
      const res = await request(app).get('/api/backup/clubs/export');
      expect(res.body[0].players[0].seasonName).toBe('2025/2026');
    });
  });
});
