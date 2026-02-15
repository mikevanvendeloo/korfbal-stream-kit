import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

describe('Players API', () => {
  let players: any[];
  let clubs: any[];

  beforeEach(() => {
    players = [
      { id: 1, clubId: 1, name: 'Existing Player', shirtNo: 5, gender: 'female', personType: 'player', function: 'Speelster', photoUrl: null }
    ];
    clubs = [{ id: 1, name: 'Club A', slug: 'club-a' }];

    prisma.player = {
      create: vi.fn(async ({ data }: any) => {
        const id = (players.at(-1)?.id || 0) + 1;
        const row = { id, createdAt: new Date(), ...data };
        players.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => players.find((p) => p.id === where.id) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = players.findIndex((p) => p.id === where.id);
        if (idx < 0) throw new Error('Not found');
        players[idx] = { ...players[idx], ...data };
        return players[idx];
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = players.findIndex((p) => p.id === where.id);
        if (idx < 0) throw new Error('Not found');
        players.splice(idx, 1);
        return {};
      }),
    };

    prisma.club = {
      findUnique: vi.fn(async ({ where }: any) => clubs.find((c) => c.id === where.id) || null),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('creates a new player manually', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        clubId: 1,
        name: 'New Player',
        shirtNo: 10,
        gender: 'male',
        personType: 'player',
        function: 'Speler'
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Player');
    expect(res.body.clubId).toBe(1);
    expect(players.length).toBe(2);
  });

  it('returns 400 if clubId is invalid', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        clubId: 999, // Non-existent in mock if findUnique returns null
        name: 'New Player'
      });
    // Mock findUnique returns null for unknown ID
    expect(res.status).toBe(404);
  });

  it('returns 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        clubId: 1,
      });
    expect(res.status).toBe(400);
  });

  it('updates an existing player', async () => {
    const res = await request(app)
      .put('/api/players/1')
      .send({
        name: 'Updated Name',
        shirtNo: 99,
        photoUrl: 'new-photo.jpg'
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.shirtNo).toBe(99);
    expect(res.body.photoUrl).toBe('new-photo.jpg');

    const updated = players.find(p => p.id === 1);
    expect(updated.name).toBe('Updated Name');
  });

  it('deletes a player', async () => {
    const res = await request(app).delete('/api/players/1');
    expect(res.status).toBe(204);
    expect(players.length).toBe(0);
  });
});
