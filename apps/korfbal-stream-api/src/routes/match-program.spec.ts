import request from 'supertest';
import app from '../main';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { config } from '../services/config';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> } as any;

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';

// In-memory store to simulate DB
let store: any[] = [];

function resetPrismaMocks() {
  store = [];
  const prisma = (prismaSvc as any).prisma as any;
  prisma.matchSchedule = {
    findUnique: vi.fn(async ({ where }: any) => store.find((m) => m.externalId === where.externalId) || null),
    create: vi.fn(async ({ data }: any) => {
      const created = { id: store.length + 1, ...data };
      store.push(created);
      return created;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const idx = store.findIndex((m) => m.externalId === where.externalId);
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...data };
        return store[idx];
      }
      throw new Error('Not found');
    }),
    findMany: vi.fn(async ({ where, orderBy }: any) => {
      let res = [...store];
      if (where?.date?.gte) {
        res = res.filter((m) => new Date(m.date) >= new Date(where.date.gte));
      }
      if (where?.date?.lte) {
        res = res.filter((m) => new Date(m.date) <= new Date(where.date.lte));
      }
      if (typeof where?.isHomeMatch === 'boolean') {
        res = res.filter((m) => !!m.isHomeMatch === where.isHomeMatch);
      }
      if (orderBy?.date === 'asc') {
        res.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      return res;
    }),
  };
}

beforeEach(() => {
  resetPrismaMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('Match schedule import and list APIs', () => {
  it('imports program items with color mapping and privacy handling (insert)', async () => {
    // Two matches, one with FULL_NAME referee, one with FIRST_NAME only
    const payload = [
      {
        id: 'm1',
        date: '2025-11-01T10:40:00.000Z',
        homeTeamName: 'Fortuna/Ruitenheer J1',
        awayTeamName: 'KCC/CK Kozijnen J1',
        accommodation: { name: 'Fortuna-hal', route: 'http://maps' },
        attendanceTime: '2025-11-01T09:40:00.000Z',
        isPracticeMatch: true,
        isHomeMatch: true,
        isCompetitiveMatch: false,
        fieldName: 'Hal 2',
        refereeAssignment: { user: { privacy: 'FULL_NAME', fullName: 'John Doe' } },
      },
      {
        id: 'm2',
        date: '2025-11-02T10:40:00.000Z',
        homeTeamName: 'Fortuna/Ruitenheer J14',
        awayTeamName: 'Other',
        isHomeMatch: false,
        refereeAssignment: { user: { privacy: 'FIRST_NAME', fullName: 'Jane Roe' } },
      },
    ];

    mockedAxios.get = vi.fn().mockResolvedValue({ data: payload });

    const res = await request(app).post('/api/match/matches/schedule/import');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.inserted).toBe(2);
    expect(res.body.updated).toBe(0);

    // Validate stored values
    expect(store.find((m) => m.externalId === 'm1')!.color).toBe('red'); // J1 => red
    expect(store.find((m) => m.externalId === 'm2')!.color).toBe('green'); // J14 => green
    expect(store.find((m) => m.externalId === 'm1')!.refereeName).toBe('John Doe');
    expect(store.find((m) => m.externalId === 'm2')!.refereeName).toBe('Jane'); // FIRST_NAME only
  });

  it('uses Authorization Bearer token and accept header when importing', async () => {
    // Set token in config to simulate real auth
    const token = 'TEST_TOKEN_123';
    (config as any).matchScheduleApiToken = token;

    mockedAxios.get = vi.fn().mockResolvedValue({ data: [] });

    const res = await request(app).post('/api/match/matches/schedule/import');
    expect(res.status).toBe(200);

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    const call = (mockedAxios.get as any).mock.calls[0];
    expect(call).toBeTruthy();
    const opts = call[1] || {};
    expect(opts.headers).toBeTruthy();
    expect(opts.headers.Authorization).toBe(`Bearer ${token}`);
    expect(opts.headers.accept).toBe('application/json');
  });

  it('cleans fieldName by removing code prefix before dash on import', async () => {
    const payload = [
      {
        id: 'f1',
        date: '2025-11-03T10:00:00.000Z',
        homeTeamName: 'Team A',
        awayTeamName: 'Team B',
        isHomeMatch: true,
        fieldName: '23b3K24 A - Veld 2b',
      },
    ];
    mockedAxios.get = vi.fn().mockResolvedValue({ data: payload });
    const res = await request(app).post('/api/match/matches/schedule/import');
    expect(res.status).toBe(200);
    const saved = store.find((m) => m.externalId === 'f1');
    expect(saved).toBeTruthy();
    expect(saved.fieldName).toBe('Veld 2b');
  });

  it('re-import updates existing rows (no duplicates)', async () => {
    const payload = [
      { id: 'm1', date: '2025-11-01T10:40:00.000Z', homeTeamName: 'Fortuna/Ruitenheer J1', awayTeamName: 'X', isHomeMatch: true },
    ];
    mockedAxios.get = vi.fn().mockResolvedValue({ data: payload });

    // First import
    let res = await request(app).post('/api/match/matches/schedule/import');
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);

    // Change awayTeamName and import again
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ ...payload[0], awayTeamName: 'Y' }] });
    res = await request(app).post('/api/match/matches/schedule/import');
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(store.length).toBe(1);
    expect(store[0].awayTeamName).toBe('Y');
  });

  it('lists matches for a day and defaults to HOME', async () => {
    // Seed store
    store.push(
      { id: 1, externalId: 'a', date: '2025-11-01T08:00:00.000Z', isHomeMatch: true, homeTeamName: 'H', awayTeamName: 'A' },
      { id: 2, externalId: 'b', date: '2025-11-01T12:00:00.000Z', isHomeMatch: false, homeTeamName: 'H2', awayTeamName: 'A2' },
      { id: 3, externalId: 'c', date: '2025-11-02T12:00:00.000Z', isHomeMatch: true, homeTeamName: 'H3', awayTeamName: 'A3' },
    );

    const res = await request(app).get('/api/match/matches/schedule?date=2025-11-01');
    expect(res.status).toBe(200);
    // Should only include the home match on 2025-11-01
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].externalId).toBe('a');

    const resAway = await request(app).get('/api/match/matches/schedule?date=2025-11-01&location=AWAY');
    expect(resAway.status).toBe(200);
    expect(resAway.body.items.length).toBe(1);
    expect(resAway.body.items[0].externalId).toBe('b');
  });
});


it('returns empty list when no matches for the day', async () => {
  const res = await request(app).get('/api/match/matches/schedule?date=2030-01-01');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.items)).toBe(true);
  expect(res.body.items.length).toBe(0);
});
