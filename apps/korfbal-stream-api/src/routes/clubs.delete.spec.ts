import request from 'supertest';
import app from '../main';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import * as prismaSvc from '../services/prisma';
const prisma = (prismaSvc as any).prisma as any;

describe('Clubs DELETE API', () => {
  let clubs: any[];
  let players: any[];

  beforeEach(() => {
    clubs = [ { id: 1, slug: 'ldodk', name: 'LDODK', shortName: 'LDODK', logoUrl: 'clubs/ldodk.png' } ];
    players = [
      { id: 1, clubId: 1, name: 'Jan Jansen', shirtNo: 7, gender: 'male', photoUrl: 'players/p1.jpg' },
      { id: 2, clubId: 1, name: 'Pietje Puk', shirtNo: 10, gender: 'female', photoUrl: 'players/p2.jpg' },
    ];

    prisma.club = {
      findUnique: vi.fn(async ({ where }: any) => clubs.find((c) => c.slug === where.slug || c.id === where.id) || null),
      findMany: vi.fn(async () => [...clubs]),
      delete: vi.fn(async ({ where }: any) => {
        const idx = clubs.findIndex((c) => c.id === where.id);
        if (idx < 0) throw new Error('Not found');
        const [removed] = clubs.splice(idx, 1);
        return removed;
      }),
    };

    prisma.player = {
      findMany: vi.fn(async ({ where }: any) => players.filter((p) => (where?.clubId != null ? p.clubId === where.clubId : true))),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = players.length;
        players = players.filter((p) => !(where?.clubId != null && p.clubId === where.clubId));
        return { count: before - players.length };
      }),
    };
  });

  it('returns 404 when club does not exist', async () => {
    const res = await request(app).delete('/api/clubs/unknown');
    expect(res.status).toBe(404);
  });

  it('deletes club and its players and returns 204', async () => {
    // sanity
    expect(clubs.length).toBe(1);
    expect(players.length).toBe(2);

    const res = await request(app).delete('/api/clubs/ldodk');
    expect(res.status).toBe(204);

    // verify removed
    expect(clubs.length).toBe(0);
    expect(players.length).toBe(0);
  });
});
