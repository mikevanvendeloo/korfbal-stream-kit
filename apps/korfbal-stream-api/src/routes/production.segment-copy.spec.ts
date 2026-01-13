import request from 'supertest';
import app from '../main';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';
const prisma = (prismaSvc as any).prisma as any;

type Segment = { id: number; productionId: number; naam: string; volgorde: number; duurInMinuten: number; isTimeAnchor: boolean };
type Assign = { id: number; productionSegmentId: number; personId: number; positionId: number; createdAt: Date };

describe('Production segment assignments copy API', () => {
  let segments: Segment[];
  let assignments: Assign[];

  beforeEach(() => {
    segments = [
      { id: 1, productionId: 10, naam: 'Bron', volgorde: 1, duurInMinuten: 10, isTimeAnchor: false },
      { id: 2, productionId: 10, naam: 'Doel A', volgorde: 2, duurInMinuten: 25, isTimeAnchor: false },
      { id: 3, productionId: 10, naam: 'Doel B', volgorde: 3, duurInMinuten: 25, isTimeAnchor: false },
      { id: 4, productionId: 99, naam: 'Andere productie', volgorde: 1, duurInMinuten: 10, isTimeAnchor: false },
    ];
    assignments = [
      { id: 1, productionSegmentId: 1, personId: 101, positionId: 201, createdAt: new Date() },
      { id: 2, productionSegmentId: 1, personId: 102, positionId: 202, createdAt: new Date() },
    ];

    prisma.productionSegment = {
      findUnique: vi.fn(async ({ where }: any) => segments.find((s) => s.id === where.id) || null),
      findMany: vi.fn(async ({ where }: any) => {
        const ids = where?.id?.in as number[];
        if (Array.isArray(ids)) return segments.filter((s) => ids.includes(s.id));
        return [];
      }),
    };

    prisma.segmentRoleAssignment = {
      findMany: vi.fn(async ({ where }: any) => assignments.filter((a) => a.productionSegmentId === where.productionSegmentId)),
      deleteMany: vi.fn(async ({ where }: any) => {
        const set = new Set(where.productionSegmentId.in as number[]);
        const before = assignments.length;
        assignments = assignments.filter((a) => !set.has(a.productionSegmentId));
        return { count: before - assignments.length };
      }),
      // create is not used by the route anymore but keep it for compatibility
      create: vi.fn(async ({ data }: any) => {
        const exists = assignments.find(
          (a) => a.productionSegmentId === data.productionSegmentId && a.personId === data.personId && a.positionId === data.positionId
        );
        if (exists) {
          const err: any = new Error('Unique violation');
          err.code = 'P2002';
          throw err;
        }
        const created = { id: (assignments.at(-1)?.id || 0) + 1, createdAt: new Date(), ...data };
        assignments.push(created);
        return created;
      }),
      createMany: vi.fn(async ({ data, skipDuplicates }: any) => {
        const rows = Array.isArray(data) ? data : [data];
        let count = 0;
        for (const d of rows) {
          const exists = assignments.find(
            (a) => a.productionSegmentId === d.productionSegmentId && a.personId === d.personId && a.positionId === d.positionId
          );
          if (exists) {
            if (skipDuplicates) {
              continue;
            } else {
              // mimic DB unique error behavior
              const err: any = new Error('Unique violation');
              err.code = 'P2002';
              throw err;
            }
          }
          const created = { id: (assignments.at(-1)?.id || 0) + 1, createdAt: new Date(), ...d };
          assignments.push(created);
          count++;
        }
        return { count };
      }),
    };

    // Emulate $transaction callback style by invoking the fn with the same mocked prisma
    prisma.$transaction = vi.fn(async (fn: any) => {
      if (typeof fn === 'function') return await fn(prisma);
      // support array form as no-op
      return [];
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('copies assignments in merge mode (default) without duplicating existing ones', async () => {
    // Pre-seed a duplicate in target 2 to ensure merge skips it
    assignments.push({ id: 99, productionSegmentId: 2, personId: 101, positionId: 201, createdAt: new Date() });

    const res = await request(app)
      .post('/api/production/segments/1/assignments/copy')
      .send({ targetSegmentIds: [2, 3] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mode).toBe('merge');
    // Source had 2. Target 2 started with 1 duplicate, so creates 1 new there; target 3 creates 2 new => total 3 created
    expect(res.body.created).toBe(3);
    expect(assignments.filter((a) => a.productionSegmentId === 2).length).toBe(2);
    expect(assignments.filter((a) => a.productionSegmentId === 3).length).toBe(2);
  });

  it('copies assignments in overwrite mode by clearing targets first', async () => {
    // Pre-seed different rows on target 2 to prove they are removed
    assignments.push({ id: 98, productionSegmentId: 2, personId: 999, skillId: 999, createdAt: new Date() });

    const res = await request(app)
      .post('/api/production/segments/1/assignments/copy')
      .send({ targetSegmentIds: [2, 3], mode: 'overwrite' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mode).toBe('overwrite');
    // deleted equals previous target entries count
    expect(res.body.deleted).toBeGreaterThanOrEqual(1);
    // After overwrite: each target has exactly the 2 from source
    expect(assignments.filter((a) => a.productionSegmentId === 2).length).toBe(2);
    expect(assignments.filter((a) => a.productionSegmentId === 3).length).toBe(2);
  });

  it('rejects when targets are from a different production', async () => {
    const res = await request(app)
      .post('/api/production/segments/1/assignments/copy')
      .send({ targetSegmentIds: [4] });

    expect(res.status).toBe(400);
  });

  it('allows copying the same source multiple times in merge mode after adding a new person', async () => {
    // First copy existing 2 assignments from source(1) to targets 2 and 3
    const first = await request(app)
      .post('/api/production/segments/1/assignments/copy')
      .send({ targetSegmentIds: [2, 3], mode: 'merge' });

    expect(first.status).toBe(200);
    expect(first.body.created).toBe(4); // 2 per target

    // Now add a new assignment to the source segment manually (simulate user add)
    assignments.push({ id: 100, productionSegmentId: 1, personId: 103, positionId: 203, createdAt: new Date() });

    // Perform copy again in merge mode; should only add the new one to each target (skip duplicates)
    const second = await request(app)
      .post('/api/production/segments/1/assignments/copy')
      .send({ targetSegmentIds: [2, 3] }); // default merge

    expect(second.status).toBe(200);
    expect(second.body.mode).toBe('merge');
    expect(second.body.created).toBe(2); // one per target for the new assignment

    // Validate final counts: each target has 3 assignments now
    expect(assignments.filter((a) => a.productionSegmentId === 2).length).toBe(3);
    expect(assignments.filter((a) => a.productionSegmentId === 3).length).toBe(3);
  });
});
