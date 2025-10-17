import request from 'supertest';
import app from '../main';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock axios to avoid real HTTP calls
import axios from 'axios';
vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> } as any;

afterEach(() => {
  vi.resetAllMocks();
});

describe('Scoreboard API', () => {
  it('returns scoreboard data from external service', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', home: 0, guest: 2 }] });

    const res = await request(app).get('/api/scoreboard');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ status: 'OK', home: 0, guest: 2 }]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get.mock.calls[0][0]).toMatch(/score-as-array$/);
  });

  it('returns shotclock data with color green (25-15)', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', time: 20 }] });

    const res = await request(app).get('/api/scoreboard/shotclock');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ status: 'OK', time: 20, color: 'green' }]);
  });

  it('returns shotclock color orange for 15 and 12', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', time: 15 }] });
    let res = await request(app).get('/api/scoreboard/shotclock');
    expect(res.status).toBe(200);
    expect(res.body[0].color).toBe('orange');

    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', time: 12 }] });
    res = await request(app).get('/api/scoreboard/shotclock');
    expect(res.status).toBe(200);
    expect(res.body[0].color).toBe('orange');
  });

  it('returns shotclock color red for 8 and 0', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', time: 8 }] });
    let res = await request(app).get('/api/scoreboard/shotclock');
    expect(res.status).toBe(200);
    expect(res.body[0].color).toBe('red');

    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', time: 0 }] });
    res = await request(app).get('/api/scoreboard/shotclock');
    expect(res.status).toBe(200);
    expect(res.body[0].color).toBe('red');
  });

  it('returns match clock data from external scoreboard (minute/second/period format)', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: [{ status: 'OK', second: '22', period: 0, minute: '0' }] });

    const res = await request(app).get('/api/scoreboard/clock');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ status: 'OK', second: '22', period: 0, minute: '0' }]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get.mock.calls[0][0]).toMatch(/time-as-array$/);
  });

  it('returns 502 when external services fail', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('network error'));

    const res1 = await request(app).get('/api/scoreboard');
    expect(res1.status).toBe(502);

    const res2 = await request(app).get('/api/scoreboard/shotclock');
    expect(res2.status).toBe(502);

    const res3 = await request(app).get('/api/scoreboard/clock');
    expect(res3.status).toBe(502);
  });
});
