import request from 'supertest';
import app from '../../main';
import {describe, expect, it} from 'vitest';

describe('Production Clocks API', () => {
  it('returns current production clocks state', async () => {
    const res = await request(app).get('/api/production/1/clocks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clocks');
    expect(res.body.clocks).toHaveProperty('productionTime');
    expect(res.body.clocks).toHaveProperty('scoreboardTime');
    expect(res.body).toHaveProperty('isClockRunning');
  });
});
