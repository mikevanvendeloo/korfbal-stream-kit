import request from 'supertest';
import app from '../main';
import { beforeEach, describe, it, expect, vi } from 'vitest';

// Mock prisma client
import * as prismaSvc from '../services/prisma';
const prisma = (prismaSvc as any).prisma as any;

describe('Production interviews API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Minimal production and schedule
    prisma.production = {
      findUnique: vi.fn(async ({ where, include }: any) => {
        if (!where?.id) return null;
        const base = { id: where.id, matchScheduleId: 42 };
        if (include?.matchSchedule) return { ...base, matchSchedule: { id: 42, homeTeamName: 'Fortuna/Ruitenheer', awayTeamName: 'Dalto/Klaverblad Verzekeringen' } };
        return base;
      }),
    };

    // Clubs
    prisma.club = {
      findFirst: vi.fn(async ({ where }: any) => {
        const shortNameClause = where?.OR?.[0]?.shortName;
        const nameClause = where?.OR?.[1]?.name;
        const name = (shortNameClause?.equals || shortNameClause?.startsWith || nameClause?.equals || nameClause?.startsWith || '').toLowerCase();
        if (name.includes('fortuna')) return { id: 1, name: 'Fortuna/Ruitenheer', shortName: 'Fortuna' };
        if (name.includes('dalto')) return { id: 2, name: 'Dalto/Klaverblad Verzekeringen', shortName: 'Dalto' };
        return null;
      }),
    };

    // Players: home has player and coach, away has others
    prisma.player = {
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.clubId === 1) {
          if (where?.personType?.equals === 'player') return [ { id: 10, clubId: 1, name: 'Home Player', personType: 'player', function: 'Speler' } ];
          return [ { id: 11, clubId: 1, name: 'Home Coach', personType: 'coach', function: 'Coach' } ];
        }
        if (where?.clubId === 2) {
          if (where?.personType?.equals === 'player') return [ { id: 20, clubId: 2, name: 'Away Player', personType: 'player', function: 'Speler' } ];
          return [ { id: 21, clubId: 2, name: 'Away Coach', personType: 'coach', function: 'Coach' } ];
        }
        return [];
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const all = [
          { id: 10, clubId: 1, name: 'Home Player', personType: 'player', function: 'Speler' },
          { id: 11, clubId: 1, name: 'Home Coach', personType: 'coach', function: 'Coach' },
          { id: 20, clubId: 2, name: 'Away Player', personType: 'player', function: 'Speler' },
          { id: 21, clubId: 2, name: 'Away Coach', personType: 'coach', function: 'Coach' },
        ];
        return all.find((p) => p.id === where?.id) || null;
      }),
    };

    // Interview subjects storage (in-memory)
    let subjects: any[] = [];
    prisma.interviewSubject = {
      findMany: vi.fn(async ({ where, include }: any) => {
        let rows = subjects.filter((s) => s.productionId === where.productionId);
        if (include?.player) {
          rows = rows.map((s) => ({
            ...s,
            player: { id: s.playerId, name: s.playerId === 10 ? 'Home Player' : s.playerId === 11 ? 'Home Coach' : s.playerId === 20 ? 'Away Player' : 'Away Coach' },
            titleDefinition: s.titleDefinitionId ? { id: s.titleDefinitionId, name: 'Some Title' } : null,
          }));
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        return subjects.find((s) => s.productionId === where.productionId && s.side === where.side && s.role === where.role && (s.titleDefinitionId ?? null) === (where.titleDefinitionId ?? null)) || null;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        subjects = subjects.filter((s) => s.productionId !== where.productionId);
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = subjects.findIndex((s) => s.id === where.id);
        if (idx < 0) throw new Error('Not found');
        subjects[idx] = { ...subjects[idx], ...data, updatedAt: new Date() };
        return subjects[idx];
      }),
      create: vi.fn(async ({ data }: any) => {
        const rec = { id: subjects.length + 1, createdAt: new Date(), updatedAt: new Date(), ...data };
        subjects.push(rec);
        return rec;
      }),
    };

    // Mock transaction to use the same mocked prisma object as tx
    prisma.$transaction = vi.fn(async (cb: any) => {
      return await cb(prisma);
    });
  });

  it('returns options for HOME PLAYER and allows saving & listing subjects', async () => {
    // Options
    const optRes = await request(app).get('/api/production/123/interviews/options').query({ side: 'HOME', role: 'PLAYER' });
    expect(optRes.status).toBe(200);
    expect(Array.isArray(optRes.body.items)).toBe(true);
    expect(optRes.body.items[0].name).toContain('Home');

    // Save
    const putRes = await request(app).put('/api/production/123/interviews').send({ items: [
      { side: 'HOME', role: 'PLAYER', playerId: 10, titleDefinitionId: null },
      { side: 'HOME', role: 'COACH', playerId: 11, titleDefinitionId: null },
    ], replaceAll: true });
    expect(putRes.status).toBe(200);
    expect(Array.isArray(putRes.body)).toBe(true);
    expect(putRes.body.some((s: any) => s.playerId === 10)).toBe(true);

    // List
    const listRes = await request(app).get('/api/production/123/interviews');
    expect(listRes.status).toBe(200);
    const rows = listRes.body as any[];
    expect(rows.length).toBe(2);
    expect(rows[0]).toHaveProperty('player');
  });
});
