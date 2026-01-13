import request from 'supertest';
import app from '../main';
import {describe, expect, it, vi} from 'vitest';

// Mock Prisma service with in-memory array so tests do not require Postgres
vi.mock('../services/prisma', () => {
  const data: any[] = [];
  return {
    prisma: {
      sponsor: {
        findMany: async ({ where, skip = 0, take = data.length }: any = {}) => {
          let arr = [...data];
          if (where?.type) arr = arr.filter((s) => s.type === where.type);
          return arr.slice(skip, skip + take);
        },
        count: async ({ where }: any = {}) => {
          if (where?.type) return data.filter((s) => s.type === where.type).length;
          return data.length;
        },
        findUnique: async ({ where: { id } }: any) => data.find((s) => s.id === id) || null,
        create: async ({ data: d }: any) => {
          const created = { id: data.length + 1, createdAt: new Date(), ...d };
          data.push(created);
          return created;
        },
        update: async ({ where: { id }, data: d }: any) => {
          const idx = data.findIndex((s) => s.id === id);
          if (idx === -1) throw Object.assign(new Error('Not found'), { code: 'P2025' });
          data[idx] = { ...data[idx], ...d };
          return data[idx];
        },
        delete: async ({ where: { id } }: any) => {
          const idx = data.findIndex((s) => s.id === id);
          if (idx === -1) throw Object.assign(new Error('Not found'), { code: 'P2025' });
          const [removed] = data.splice(idx, 1);
          return removed;
        },
      },
    },
  };
});

describe('Sponsors API', () => {
  it('should create a sponsor and return it with derived logoUrl', async () => {
    const payload = { name: 'ACME BV', type: 'premium', websiteUrl: 'https://acme.example' };
    const res = await request(app).post('/api/sponsors').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 1,
      name: 'ACME BV',
      type: 'premium',
      websiteUrl: 'https://acme.example',
      logoUrl: 'acme-bv.png',
    });
  });

  it('should list sponsors including the one created with pagination envelope', async () => {
    const res = await request(app).get('/api/sponsors');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body).toMatchObject({ page: 1, limit: 25 });
  });

  it('filters by type and paginates', async () => {
    // create multiple sponsors
    await request(app).post('/api/sponsors').send({ name: 'Beta BV', type: 'goud', websiteUrl: 'https://beta.example' });
    await request(app).post('/api/sponsors').send({ name: 'Gamma BV', type: 'goud', websiteUrl: 'https://gamma.example' });
    await request(app).post('/api/sponsors').send({ name: 'Delta BV', type: 'zilver', websiteUrl: 'https://delta.example' });

    const listGoud = await request(app).get('/api/sponsors?type=goud&limit=1&page=2');
    expect(listGoud.status).toBe(200);
    expect(listGoud.body.limit).toBe(1);
    expect(listGoud.body.page).toBe(2);
    expect(listGoud.body.total).toBeGreaterThanOrEqual(2);
    expect(listGoud.body.items.every((i: any) => i.type === 'goud')).toBe(true);
  });

  it('should get sponsor by id and then update and delete it', async () => {
    const getRes = await request(app).get('/api/sponsors/1');
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('id', 1);

    const updateRes = await request(app).put('/api/sponsors/1').send({ name: 'ACME NL' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({ name: 'ACME NL', logoUrl: 'acme-nl.png' });

    const deleteRes = await request(app).delete('/api/sponsors/1');
    expect(deleteRes.status).toBe(204);
  });

  it('should validate missing fields', async () => {
    const res = await request(app).post('/api/sponsors').send({});
    expect(res.status).toBe(400);
  });
});
