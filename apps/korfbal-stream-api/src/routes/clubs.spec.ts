import request from 'supertest';
import app from '../main';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';
const prisma = (prismaSvc as any).prisma as any;

// Provide a controllable global fetch
const g: any = globalThis as any;

describe('Clubs import and listing API', () => {
  let clubs: any[];
  let players: any[];

  beforeEach(() => {
    clubs = [];
    players = [];

    prisma.club = {
      findUnique: vi.fn(async ({ where }: any) => clubs.find((c) => c.slug === where.slug || c.id === where.id) || null),
      findMany: vi.fn(async ({ orderBy }: any) => {
        const rows = [...clubs];
        if (orderBy?.name === 'asc') rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows;
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = (clubs.at(-1)?.id || 0) + 1;
        const row = { id, createdAt: new Date(), ...data };
        clubs.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = clubs.findIndex((c) => c.id === where.id);
        if (idx < 0) throw new Error('Not found');
        clubs[idx] = { ...clubs[idx], ...data };
        return clubs[idx];
      }),
    };

    prisma.player = {
      findUnique: vi.fn(async ({ where }: any) => players.find((p) => p.externalId && p.externalId === where.externalId) || null),
      findFirst: vi.fn(async ({ where }: any) => players.find((p) => p.clubId === where.clubId && p.name === where.name && (p.shirtNo ?? null) === (where.shirtNo ?? null)) || null),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let rows = players.filter((p) => (where?.clubId != null ? p.clubId === where.clubId : true));
        if (Array.isArray(orderBy)) {
          for (const o of orderBy) {
            const [[k, dir]] = Object.entries(o) as any;
            rows = rows.sort((a: any, b: any) => {
              const av = a[k] ?? 9999; const bv = b[k] ?? 9999; // nulls last for shirtNo
              if (av === bv) return 0;
              return dir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
            });
          }
        }
        return rows;
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = (players.at(-1)?.id || 0) + 1;
        const row = { id, createdAt: new Date(), ...data };
        players.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = players.findIndex((p) => p.id === where.id);
        if (idx < 0) throw new Error('Not found');
        players[idx] = { ...players[idx], ...data };
        return players[idx];
      }),
    };

    // mock fetch for external API, person template, and image downloads
    g.fetch = vi.fn(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.toString?.() || '';
      if (url.startsWith('https://api-saas-site-prod-236.dotlab.net/general/api/get-template-data')) {
        // Distinguish by data_key
        let body: any = {};
        try { body = init?.body ? JSON.parse(init.body) : {}; } catch {}
        const dataKey = body?.data_key;
        if (dataKey === 'sportsuite_get_person_cards') {
          // Return a team/cards payload
          const ctx = body?.context || {};
          const teamId = String(ctx?.team_id || ctx?.data_entity_id || '9');
          const isLdodk = teamId === '9';
          const team = isLdodk
            ? {
                team_name: 'LDODK/Rinsma Modeplein 1',
                team_name_short: 'LDODK',
                team_image: { url: 'https://example.com/logo.png' },
              }
            : {
                team_name: 'Fortuna/Delta Logistiek 1',
                team_name_short: 'Fortuna',
                team_image: { url: 'https://example.com/logo2.png' },
              };
          const cards = isLdodk
            ? [ { person: { id: 1, fullname: 'Jan Jansen', back_number: 7, gender: 'M', image: { url: 'https://example.com/p1.jpg' } } }, { person: { id: 2, fullname: 'Pietje Puk', back_number: 10, gender: 'F', image: { url: 'https://example.com/p2.jpg' } } } ]
            : [ { person: { id: 2, fullname: 'Pietje Puk', back_number: 10, gender: 'F', image: { url: 'https://example.com/p2.jpg' } } } ];
          return new Response(JSON.stringify({ result: { team, cards } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
        }
        // Person template POST: read person_id from body
        const pid = String(body?.context?.person_id || '');
        // Return gender and names depending on person id
        if (pid === '1') {
          return new Response(JSON.stringify({ result: { person: { first_name: 'Jan', last_name: 'Jansen', gender: 'm' } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
        }
        if (pid === '2') {
          return new Response(JSON.stringify({ result: { person: { first_name: 'Pietje', last_name: 'Puk', gender: 'f' } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
        }
        return new Response(JSON.stringify({ result: { person: { gender: 'm' } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
      }
      if (url.startsWith('https://api-saas-site-prod')) {
        // Legacy stream/team payload (fallback)
        return new Response(
          JSON.stringify({
            result: {
              team: {
                team_name: 'LDODK/Rinsma Modeplein 1',
                team_name_short: 'LDODK',
                team_image: { url: 'https://example.com/logo.png' },
                players: [
                  { id: 1, fullname: 'Jan Jansen', back_number: 7, gender: 'M', image: { url: 'https://example.com/p1.jpg' } },
                  { id: 2, fullname: 'Pietje Puk', back_number: 10, gender: 'F', image: { url: 'https://example.com/p2.jpg' } },
                ],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ) as any;
      }
      // image download -> return small buffer
      const bytes = new Uint8Array([137, 80, 78, 71]);
      return new Response(bytes, { status: 200, headers: { 'content-type': url.endsWith('.jpg') ? 'image/jpeg' : 'image/png' } }) as any;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('imports a club and players from external API and is idempotent', async () => {
    const res = await request(app)
      .post('/api/clubs/import')
      .send({ teamId: '9', poolId: '95865' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.clubsCreated).toBe(1);
    expect(res.body.playersCreated).toBe(2);

    // Import again -> should update not duplicate
    const res2 = await request(app)
      .post('/api/clubs/import')
      .send({ teamId: '9', poolId: '95865' });

    expect(res2.status).toBe(200);
    expect(res2.body.clubsUpdated).toBe(1);
    expect(res2.body.playersUpdated).toBe(2);

    // List clubs
    const list = await request(app).get('/api/clubs');
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].slug).toBe('ldodk');

    // List players for club by slug (dropdown)
    const playersRes = await request(app).get('/api/clubs/ldodk/players');
    expect(playersRes.status).toBe(200);
    expect(playersRes.body.length).toBe(2);
    expect(playersRes.body[0].name).toBeDefined();
    // Ordered by shirtNo then name
    expect(playersRes.body[0].shirtNo).toBeLessThanOrEqual(playersRes.body[1].shirtNo);

    // Enrichment: genders mapped from template (m/f -> male/female) and names preserved/overridden
    const byName: Record<string, any> = Object.fromEntries(playersRes.body.map((p: any) => [p.name, p]));
    expect(byName['Jan Jansen'].gender).toBe('male');
    expect(byName['Pietje Puk'].gender).toBe('female');
  });

  it('accepts direct payload with name and players array', async () => {
    const res = await request(app)
      .post('/api/clubs/import')
      .send({
        name: 'Fortuna/Delta Logistiek',
        shortName: 'Fortuna',
        logoUrl: 'https://example.com/fortuna.png',
        players: [
          { name: 'Alice', shirtNo: 3, gender: 'female', photoUrl: 'https://example.com/a.jpg' },
          { name: 'Bob', shirtNo: 8, gender: 'male', photoUrl: 'https://example.com/b.jpg' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.clubsCreated).toBe(1);
    expect(res.body.playersCreated).toBe(2);

    const list = await request(app).get('/api/clubs');
    expect(list.body[0].slug).toBe('fortuna');

    const playersList = await request(app).get('/api/clubs/fortuna/players');
    expect(playersList.body.length).toBe(2);
  });

  it('returns 400 when no sources provided', async () => {
    const res = await request(app).post('/api/clubs/import').send({});
    expect(res.status).toBe(400);
  });
});
