import request from 'supertest';
import app from '../main';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    expect(res.body['sponsor-names']).toBe('Alpha BV   |   Beta Co   |   Gamma N.V.   |   ');
    expect(prisma.sponsor.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns empty string when there are no sponsors', async () => {
    prisma.sponsor.findMany = vi.fn(async () => []);

    const res = await request(app).get('/api/vmix/sponsor-names');

    expect(res.status).toBe(200);
    expect(res.body['sponsor-names']).toBe('');
  });
});
