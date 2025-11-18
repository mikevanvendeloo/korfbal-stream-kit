import request from 'supertest';
import app from '../main';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';
const prisma = (prismaSvc as any).prisma as any;

type Segment = { id: number; productionId: number; naam: string; volgorde: number; duurInMinuten: number; isTimeAnchor: boolean };

describe('Production segments order (create/put shifting)', () => {
  let segments: Segment[];

  beforeEach(() => {
    segments = [
      { id: 1, productionId: 10, naam: 'S1', volgorde: 1, duurInMinuten: 10, isTimeAnchor: false },
      { id: 2, productionId: 10, naam: 'S2', volgorde: 2, duurInMinuten: 10, isTimeAnchor: false },
      { id: 3, productionId: 10, naam: 'S3', volgorde: 3, duurInMinuten: 10, isTimeAnchor: false },
      { id: 4, productionId: 10, naam: 'S4', volgorde: 4, duurInMinuten: 10, isTimeAnchor: false },
    ];

    // Minimal mocks used by the tested routes
    prisma.production = {
      findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, matchScheduleId: 100 })),
    };

    prisma.productionSegment = {
      findUnique: vi.fn(async ({ where }: any) => segments.find((s) => s.id === where.id) || null),
      aggregate: vi.fn(async ({ where }: any) => {
        const max = Math.max(0, ...segments.filter((s) => s.productionId === where.productionId).map((s) => s.volgorde));
        return { _max: { volgorde: max } };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const matches = segments.filter((s) => {
          if (s.productionId !== where.productionId) return false;
          if (where.NOT?.id && s.id === where.NOT.id) return false;
          const gte = where.volgorde?.gte ?? -Infinity;
          const lte = where.volgorde?.lte ?? Infinity;
          const ge = where.volgorde?.gt ?? -Infinity;
          const le = where.volgorde?.lt ?? Infinity;
          let ok = true;
          if (where.volgorde) {
            ok = ok && s.volgorde >= (gte as number) && s.volgorde <= (lte as number);
            ok = ok && s.volgorde > (ge as number) && s.volgorde < (le as number);
          }
          return ok;
        });
        for (const m of matches) {
          if (data.volgorde?.increment) m.volgorde += data.volgorde.increment;
          if (data.volgorde?.decrement) m.volgorde -= data.volgorde.decrement;
          if (typeof data.isTimeAnchor === 'boolean') m.isTimeAnchor = data.isTimeAnchor;
        }
        return { count: matches.length };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = segments.findIndex((s) => s.id === where.id);
        if (idx < 0) throw new Error('Not found');
        segments[idx] = { ...segments[idx], ...data };
        return segments[idx];
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = (segments.at(-1)?.id || 0) + 1;
        const created: Segment = { id, naam: data.naam, productionId: data.productionId, volgorde: data.volgorde, duurInMinuten: data.duurInMinuten, isTimeAnchor: !!data.isTimeAnchor };
        // In real DB, unique constraint could throw; our route shifts first to avoid this
        segments.push(created);
        return created;
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let rows = segments;
        if (where?.productionId != null) rows = rows.filter((s) => s.productionId === where.productionId);
        if (orderBy?.volgorde === 'asc') rows = [...rows].sort((a, b) => a.volgorde - b.volgorde);
        return rows;
      }),
    };

    // Emulate $transaction with callback form
    prisma.$transaction = vi.fn(async (fn: any) => {
      if (typeof fn === 'function') return await fn(prisma);
      return [];
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('moves a segment up (target index smaller) and shifts others down', async () => {
    const res = await request(app)
      .put('/api/production/segments/3')
      .send({ volgorde: 1 });
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/production/10/segments');
    expect(list.status).toBe(200);
    const orders = list.body.map((s: any) => `${s.id}:${s.volgorde}`).join(',');
    expect(orders).toBe('3:1,1:2,2:3,4:4');
  });

  it('moves a segment down (target index larger) and shifts others up', async () => {
    const res = await request(app)
      .put('/api/production/segments/2')
      .send({ volgorde: 4 });
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/production/10/segments');
    expect(list.status).toBe(200);
    const orders = list.body.map((s: any) => `${s.id}:${s.volgorde}`).join(',');
    expect(orders).toBe('1:1,3:2,4:3,2:4');
  });

  it('supports swapping two neighbors via sequential PUTs (no unique violations)', async () => {
    // Move segment 2 to position 3
    const a = await request(app)
      .put('/api/production/segments/2')
      .send({ volgorde: 3 });
    expect(a.status).toBe(200);

    // Then move segment 3 to position 2
    const b = await request(app)
      .put('/api/production/segments/3')
      .send({ volgorde: 2 });
    expect(b.status).toBe(200);

    const list = await request(app).get('/api/production/10/segments');
    const orders = list.body.map((s: any) => `${s.id}:${s.volgorde}`).join(',');
    expect(orders).toBe('1:1,3:2,2:3,4:4');
  });

  it('creates a segment at a conflicting volgorde by shifting existing ones to make room', async () => {
    const res = await request(app)
      .post('/api/production/10/segments')
      .send({ naam: 'Inserted', duurInMinuten: 5, volgorde: 2, isTimeAnchor: false });
    expect(res.status).toBe(201);

    const list = await request(app).get('/api/production/10/segments');
    const pairs = list.body.map((s: any) => `${s.naam}:${s.volgorde}`);
    // Expect new at 2, previous [2..4] shifted to [3..5]
    expect(pairs).toContain('Inserted:2');
    expect(pairs).toContain('S2:3');
    expect(pairs).toContain('S3:4');
    expect(pairs).toContain('S4:5');
  });

  it('inserting at position 2 when 5 segments exist shifts [2..5] to [3..6] and new is #2', async () => {
    // Ensure we start from a clean 4, then add a 5th
    const prismaAny = (prisma as any);
    await prismaAny.productionSegment.create({
      data: { id: 5, productionId: 10, naam: 'S5', volgorde: 5, duurInMinuten: 10, isTimeAnchor: false },
    });

    // Now insert new segment at volgorde 2
    const res = await request(app)
      .post('/api/production/10/segments')
      .send({ naam: 'Nieuw', duurInMinuten: 3, volgorde: 2 });
    expect(res.status).toBe(201);

    const list = await request(app).get('/api/production/10/segments');
    expect(list.status).toBe(200);
    // Expect orders: 1:1, Nieuw:2, 2:3, 3:4, 4:5, 5:6
    const byNameOrder = Object.fromEntries(list.body.map((s: any) => [s.naam, s.volgorde]));
    expect(byNameOrder['S1']).toBe(1);
    expect(byNameOrder['Nieuw']).toBe(2);
    expect(byNameOrder['S2']).toBe(3);
    expect(byNameOrder['S3']).toBe(4);
    expect(byNameOrder['S4']).toBe(5);
    expect(byNameOrder['S5']).toBe(6);
  });

  it('appends a segment when no volgorde provided', async () => {
    const res = await request(app)
      .post('/api/production/10/segments')
      .send({ naam: 'Tail', duurInMinuten: 7 });
    expect(res.status).toBe(201);

    const list = await request(app).get('/api/production/10/segments');
    const maxOrder = Math.max(...list.body.map((s: any) => s.volgorde));
    const tail = list.body.find((s: any) => s.naam === 'Tail');
    expect(tail.volgorde).toBe(maxOrder);
  });

  it('moves 5th segment to 4th and shifts previous 4th to 5th (clashing volgorde handled)', async () => {
    // Ensure we have a 5th segment
    // @ts-ignore augment test-local state
    const prismaAny = (prisma as any);
    // Create a 5th segment in the mocked store
    await prismaAny.productionSegment.create({
      data: { id: 5, productionId: 10, naam: 'S5', volgorde: 5, duurInMinuten: 10, isTimeAnchor: false },
    });

    // Move S5 (volgorde 5) to position 4
    const res = await request(app)
      .put('/api/production/segments/5')
      .send({ volgorde: 4 });
    expect(res.status).toBe(200);

    // Validate the orders after shifting: S4 should be at 5, S5 at 4
    const list2 = await request(app).get('/api/production/10/segments');
    expect(list2.status).toBe(200);
    const orders = list2.body.map((s: any) => `${s.id}:${s.volgorde}`).join(',');
    expect(orders).toBe('1:1,2:2,3:3,5:4,4:5');
  });

  it('clamps overly large target volgorde and still updates fields', async () => {
    // Change S1 name and duration while requesting an out-of-range position
    const res = await request(app)
      .put('/api/production/segments/1')
      .send({ naam: 'S1 changed', duurInMinuten: 15, volgorde: 999 });
    expect(res.status).toBe(200);

    // Order should be unchanged except potential move to end if target > max; since we clamp to max (=4),
    // moving from 1 -> 4 should shift others up.
    const list = await request(app).get('/api/production/10/segments');
    expect(list.status).toBe(200);
    const byId: Record<number, any> = Object.fromEntries(list.body.map((s: any) => [s.id, s]));

    // Validate new order and updated fields
    // From initial [1,2,3,4] move id=1 to end results in [2,3,4,1]
    const orders = list.body.map((s: any) => s.id).join(',');
    expect(orders).toBe('2,3,4,1');
    expect(byId[1].volgorde).toBe(4);
    expect(byId[1].naam).toBe('S1 changed');
    expect(byId[1].duurInMinuten).toBe(15);
  });
});
