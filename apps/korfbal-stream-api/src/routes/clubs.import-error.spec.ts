import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';
import * as loggerMod from '../utils/logger';

const prisma = (prismaSvc as any).prisma as any;

// Provide a controllable global fetch
const g: any = globalThis as any;

describe('Clubs import logs error on template HTTP error', () => {
  let clubs: any[];
  let players: any[];
  const logger = (loggerMod as any).logger as { error: (...args: any[]) => void; info: (...args: any[]) => void };

  beforeEach(() => {
    clubs = [];
    players = [];

    prisma.club = {
      findUnique: vi.fn(async ({ where }: any) => clubs.find((c) => c.slug === where.slug || c.id === where.id) || null),
      create: vi.fn(async ({ data }: any) => { const id = (clubs.at(-1)?.id || 0) + 1; const row = { id, createdAt: new Date(), ...data }; clubs.push(row); return row; }),
      update: vi.fn(async ({ where, data }: any) => { const idx = clubs.findIndex((c) => c.id === where.id); clubs[idx] = { ...clubs[idx], ...data }; return clubs[idx]; }),
    };

    prisma.player = {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => { const id = (players.at(-1)?.id || 0) + 1; const row = { id, createdAt: new Date(), ...data }; players.push(row); return row; }),
      update: vi.fn(async ({ where, data }: any) => { const idx = players.findIndex((p) => p.id === where.id); players[idx] = { ...players[idx], ...data }; return players[idx]; }),
    };

    // mock fetch: team page OK, template POST returns 500, legacy stream/team returns OK but empty list (so overall import still returns ok with problems)
    g.fetch = vi.fn(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.toString?.() || '';
      if (url === 'https://league.korfbal.nl/teams/') {
        const html = `<a href="/team/ldodk-1/">LDODK 1</a>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) as any;
      }
      if (url.includes('/team/ldodk-1/')) {
        // Provide data-layout_context so ids can be extracted
        const ctx = { tenant: 'league', pool_ids: ['95865'], team_id: '9', language: 'nl' };
        const dataAttr = JSON.stringify(ctx).replace(/"/g, '&quot;').replace(/"/g, '&quot;');
        const html = `<div class="page-wrapper" data-layout_context="${dataAttr}">Team</div>`;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) as any;
      }
      if (url.startsWith('https://api-saas-site-prod-236.dotlab.net/general/api/get-template-data')) {
        // Return HTTP error to trigger error-level logging
        return new Response('error', { status: 500, headers: { 'content-type': 'text/plain' } }) as any;
      }
      if (url.startsWith('https://api-saas-site-prod')) {
        // legacy fallback: minimal payload with empty players
        return new Response(JSON.stringify({ result: { team: { team_name: 'LDODK', team_name_short: 'LDODK', team_image: { url: 'https://example.com/logo.png' }, players: [] } } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
      }
      // images
      return new Response(new Uint8Array([137,80,78,71]), { status: 200, headers: { 'content-type': 'image/png' } }) as any;
    });

    vi.spyOn(logger, 'error').mockImplementation(() => { /* empty */ });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('logs error when template cards endpoint returns non-OK', async () => {
    const res = await request(app)
      .post('/api/clubs/import/league-teams')
      .send({ limit: 1 });

    expect(res.status).toBe(200); // overall route still succeeds with fallback
    expect((logger.error as any).mock.calls.some((args: any[]) => String(args[0]).includes('Template cards fetch failed'))).toBe(true);
  });
});
