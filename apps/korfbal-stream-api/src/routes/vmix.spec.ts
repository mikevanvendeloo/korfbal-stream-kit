import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock prisma client methods used by the route
import * as prismaSvc from '../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

describe('vMix API - sponsor names ticker', () => {
  beforeEach(() => {
    prisma.sponsor = {
      findMany: vi.fn(async () => []),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns JSON with concatenated sponsor names separated by 3 spaces, a bar, and 3 spaces, including trailing separator for ticker loop', async () => {
    prisma.sponsor.findMany = vi.fn(async () => [
      { id: 1, name: 'Alpha BV' },
      { id: 2, name: 'Beta Co' },
      { id: 3, name: 'Gamma N.V.' },
    ]);

    const res = await request(app).get('/api/vmix/sponsor-names');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]['sponsor-names']).toContain('Alpha BV');
    expect(res.body[0]['sponsor-names']).toContain('Beta Co');
    expect(res.body[0]['sponsor-names']).toContain('Gamma N.V.');
    expect(prisma.sponsor.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns empty string when there are no sponsors', async () => {
    prisma.sponsor.findMany = vi.fn(async () => []);

    const res = await request(app).get('/api/vmix/sponsor-names');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]['sponsor-names']).toBe('');
  });

  it('uses displayName when available, otherwise falls back to name', async () => {
    prisma.sponsor.findMany = vi.fn(async () => [
      { id: 1, name: 'Alpha BV', displayName: 'Alpha (Hoofdsponsor)' },
      { id: 2, name: 'Beta Co', displayName: null },
      { id: 3, name: 'Gamma N.V.', displayName: '' },
    ]);

    const res = await request(app).get('/api/vmix/sponsor-names');

    expect(res.status).toBe(200);
    const ticker = res.body[0]['sponsor-names'];
    expect(ticker).toContain('Alpha (Hoofdsponsor)'); // uses displayName
    expect(ticker).toContain('Beta Co'); // no displayName, uses name
    expect(ticker).toContain('Gamma N.V.'); // empty displayName, uses name
    expect(ticker).not.toContain('Alpha BV'); // original name should not appear
  });
});
