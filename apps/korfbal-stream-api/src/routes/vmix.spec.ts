import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock prisma client methods used by the route
import * as prismaSvc from '../services/prisma';
import * as appSettings from '../services/appSettings';

const prisma = (prismaSvc as any).prisma as any;

// Mock appSettings
vi.mock('../services/appSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof appSettings>();
  return {
    ...actual,
    getSponsorNamesTypes: vi.fn(async () => ['premium', 'goud', 'zilver']),
    getSponsorRowsTypes: vi.fn(async () => ['premium', 'goud', 'zilver']),
  };
});

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
      { id: 1, name: 'Alpha BV', type: 'premium' },
      { id: 2, name: 'Beta Co', type: 'goud' },
      { id: 3, name: 'Gamma N.V.', type: 'zilver' },
    ]);

    const res = await request(app).get('/api/vmix/sponsor-names');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Array.isArray(res.body)).toBe(true);
    // The order is shuffled, so we just check containment
    const ticker = res.body[0]['sponsor-names'];
    expect(ticker).toContain('Alpha BV');
    expect(ticker).toContain('Beta Co');
    expect(ticker).toContain('Gamma N.V.');
    expect(prisma.sponsor.findMany).toHaveBeenCalledTimes(1);
    // Verify it used the default types from mock
    expect(prisma.sponsor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: { in: ['premium', 'goud', 'zilver'] } }
    }));
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
      { id: 1, name: 'Alpha BV', displayName: 'Alpha (Hoofdsponsor)', type: 'premium' },
      { id: 2, name: 'Beta Co', displayName: null, type: 'goud' },
      { id: 3, name: 'Gamma N.V.', displayName: '', type: 'zilver' },
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
