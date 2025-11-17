import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

// Provide a controllable global fetch
const g: any = globalThis as any;

describe('Clubs import from league teams index', () => {
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

    // mock fetch for index HTML, team pages, template, team API JSON, and image downloads
    g.fetch = vi.fn(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.toString?.() || '';

      if (url === 'https://league.korfbal.nl/teams/') {
        const html = `
          <html><body>
            <a href="https://league.korfbal.nl/team/ldodk-1/">LDODK 1</a>
            <a href="/team/fortuna-1/">Fortuna 1</a>
          </body></html>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) as any;
      }

      if (url.includes('/team/ldodk-1/')) {
        // include a stream/team URL with encoded context
        const ctx = encodeURIComponent(JSON.stringify({ 'preferred-group': null, tenant: 'league', pool_ids: ['95865'], team_id: '9', language: 'nl', data_channel: 'team', data_sse: true, data_namespace: 'public', data_entity_id: '9' }));
        const html = `<html><body><script>const x = "https://api-saas-site-prod-236.dotlab.net/general/api/stream/team?context=${ctx}";</script></body></html>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) as any;
      }

      if (url.includes('/team/fortuna-1/')) {
        const ctx = encodeURIComponent(JSON.stringify({ tenant: 'league', pool_ids: ['95865'], team_id: '12', language: 'nl', data_channel: 'team', data_sse: true, data_namespace: 'public', data_entity_id: '12' }));
        const html = `<html><body>... <a href="https://api-saas-site-prod-236.dotlab.net/general/api/stream/team?context=${ctx}">api</a> ...</body></html>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) as any;
      }

      if (url.startsWith('https://api-saas-site-prod-236.dotlab.net/general/api/get-template-data')) {
        // Distinguish by data_key
        let body: any = {};
        try { body = init?.body ? JSON.parse(init.body) : {}; } catch {}
        const dataKey = body?.data_key;
        if (dataKey === 'sportsuite_get_person_cards') {
          const ctx = body?.context || {};
          const teamId = String(ctx?.team_id || ctx?.data_entity_id || '9');
          const isLdodk = teamId === '9';
          const team = isLdodk
            ? { team_name: 'LDODK/Rinsma Modeplein 1', team_name_short: 'LDODK', team_image: { url: 'https://example.com/logo.png' } }
            : { team_name: 'Fortuna/Delta Logistiek 1', team_name_short: 'Fortuna', team_image: { url: 'https://example.com/logo2.png' } };
          const cards = isLdodk
            ? [ { person: { id: 1, fullname: 'Jan Jansen', back_number: 7, gender: 'M', image: { url: 'https://example.com/p1.jpg' } } } ]
            : [ { person: { id: 2, fullname: 'Pietje Puk', back_number: 10, gender: 'F', image: { url: 'https://example.com/p2.jpg' } } } ];
          return new Response(JSON.stringify({ result: { team, cards } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
        }
        // Person template POST: read person_id from body
        const pid = String(body?.context?.person_id || '');
        if (pid === '1') {
          return new Response(JSON.stringify({ result: { person: { first_name: 'Jan', last_name: 'Jansen', gender: 'm' } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
        }
        if (pid === '2') {
          return new Response(JSON.stringify({ result: { person: { first_name: 'Pietje', last_name: 'Puk', gender: 'f' } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
        }
        return new Response(JSON.stringify({ result: { person: { gender: 'm' } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
      }

      if (url.startsWith('https://api-saas-site-prod')) {
        // Legacy stream/team payload (fallback if template not used)
        const u = new URL(url);
        const ctxParam = u.searchParams.get('context') || '';
        let teamId = '9';
        try { const ctx = JSON.parse(decodeURIComponent(ctxParam)); teamId = String(ctx.team_id || ctx.data_entity_id || '9'); } catch {}
        const isLdodk = teamId === '9';
        const teamName = isLdodk ? 'LDODK/Rinsma Modeplein 1' : 'Fortuna/Ruitenheer 1';
        const teamShort = isLdodk ? 'LDODK' : 'Fortuna';
        const playersPayload = isLdodk
          ? [ { id: 1, fullname: 'Jan Jansen', back_number: 7, gender: 'M', image: { url: 'https://example.com/p1.jpg' } } ]
          : [ { id: 2, fullname: 'Pietje Puk', back_number: 10, gender: 'F', image: { url: 'https://example.com/p2.jpg' } } ];
        return new Response(
          JSON.stringify({ result: { team: { team_name: teamName, team_name_short: teamShort, team_image: { url: 'https://example.com/logo.png' }, players: playersPayload } } }),
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

  it('scrapes index, extracts team ids, and imports clubs & players (idempotent)', async () => {
    const res = await request(app)
      .post('/api/clubs/import/league-teams')
      .send({ limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.clubsCreated).toBe(2);
    expect(res.body.playersCreated).toBe(2);

    // Idempotent second run
    const res2 = await request(app)
      .post('/api/clubs/import/league-teams')
      .send({ limit: 2 });
    expect(res2.status).toBe(200);
    expect(res2.body.clubsUpdated).toBe(2);
    expect(res2.body.playersUpdated).toBe(2);

    // Clubs list should contain two slugs
    const list = await request(app).get('/api/clubs');
    expect(list.status).toBe(200);
    const slugs = list.body.map((c: any) => c.slug).sort();
    expect(slugs).toContain('ldodk');
    expect(slugs).toContain('fortuna');
  });

  it('extracts teamId/poolId from data-layout_context on team page and imports successfully', async () => {
    const g: any = globalThis as any;
    // Index with a single team link
    (g.fetch as any)
      .mockImplementationOnce(async () => new Response('<a href="/team/layout-team/">Layout Team</a>', { status: 200, headers: { 'content-type': 'text/html' } }))
      // Team page containing the page-wrapper with data-layout_context (no stream URL)
      .mockImplementationOnce(async () => {
        const ctx = { 'preferred-group': null, tenant: 'league', pool_ids: ['95865'], team_id: '42', language: 'nl' };
        const dataAttr = JSON.stringify(ctx).replace(/"/g, '&quot;');
        const html = `<div class="page-wrapper" data-layout_context="${dataAttr}">Team</div>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) as any;
      })
      // Team API response for team 42
      .mockImplementationOnce(async (input: any) => {
        const url = typeof input === 'string' ? input : input?.toString?.() || '';
        if (url.startsWith('https://api-saas-site-prod')) {
          return new Response(
            JSON.stringify({ result: { team: { team_name: 'Layout FC', team_name_short: 'Layout', team_image: { url: 'https://example.com/logo.png' }, players: [ { id: 1, fullname: 'Alice Example', back_number: 1, gender: 'F', image: { url: 'https://example.com/a.jpg' } } ] } } }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          ) as any;
        }
        // template and image fallbacks
        return new Response(new Uint8Array([137,80,78,71]), { status: 200, headers: { 'content-type': 'image/png' } }) as any;
      });

    const res = await request(app)
      .post('/api/clubs/import/league-teams')
      .send({ limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.clubsCreated).toBe(1);
    expect(res.body.playersCreated).toBe(1);
  });

  it('returns 400 when no team pages yield ids', async () => {
    // Override fetch for index to include a bad team page that doesn't contain an API URL
    (g.fetch as any).mockImplementationOnce(async () => new Response('<a href="/team/bad/">Bad</a>', { status: 200 }))
      .mockImplementationOnce(async () => new Response('<html><body>No api here</body></html>', { status: 200 }));

    const res = await request(app)
      .post('/api/clubs/import/league-teams')
      .send({ limit: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
