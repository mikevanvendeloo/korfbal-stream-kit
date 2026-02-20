import request from 'supertest';
import app from '../main';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

async function makeWorkbookBuffer(rows: Array<Record<string, any>>, sheetName = 'Callsheet'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    ws.columns = headers.map(h => ({ header: h, key: h }));
    rows.forEach(r => ws.addRow(r));
  }

  const buf = await workbook.xlsx.writeBuffer();
  return buf as Buffer;
}

describe('Callsheet Excel import API', () => {
  beforeEach(() => {
    const positions: any[] = [];
    const callSheets: any[] = [];
    const items: any[] = [];
    const itemPositions: any[] = [];

    prisma.production = {
      findUnique: vi.fn(async ({ where }: any) => (where.id === 1 ? { id: 1 } : null)),
    };

    // Emulate Prisma transaction by invoking callback with same mocked client as tx
    prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

    prisma.productionSegment = {
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.productionId !== 1) return [];
        return [
          { id: 10, productionId: 1, naam: 'Opbouw', volgorde: 1 },
          { id: 11, productionId: 1, naam: 'Wedstrijd', volgorde: 2 },
        ];
      }),
    };

    prisma.position = {
      findMany: vi.fn(async () => positions.slice()),
      create: vi.fn(async ({ data }: any) => {
        const exists = positions.find((p) => p.name.toLowerCase() === data.name.toLowerCase());
        if (exists) return exists;
        const created = { id: positions.length + 1, name: data.name };
        positions.push(created);
        return created;
      }),
    };

    prisma.callSheet = {
      create: vi.fn(async ({ data }: any) => {
        const created = { id: callSheets.length + 1, createdAt: new Date(), updatedAt: new Date(), ...data };
        callSheets.push(created);
        return created;
      }),
      findMany: vi.fn(async () => callSheets.slice()),
    };

    prisma.callSheetItem = {
      create: vi.fn(async ({ data }: any) => {
        const created = { ...data, createdAt: new Date(), updatedAt: new Date() };
        items.push(created);
        return created;
      }),
      findMany: vi.fn(async ({ where }: any) => items.filter((i) => i.callSheetId === where.callSheetId)),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = items.length;
        for (let i = items.length - 1; i >= 0; i--) if (items[i].callSheetId === where.callSheetId) items.splice(i, 1);
        return { count: before - items.length };
      }),
    };

    prisma.callSheetItemPosition = {
      createMany: vi.fn(async ({ data }: any) => {
        for (const row of data) itemPositions.push(row);
        return { count: data.length };
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('imports a callsheet from uploaded Excel and creates items and positions', async () => {
    const buf = await makeWorkbookBuffer([
      { Segment: 'Opbouw', Cue: 'CUE1', Title: 'Intro', Duration: '00:30', Positions: 'Director; Shader' },
      { Segment: 'Wedstrijd', Cue: 'CUE2', Title: 'Kickoff', Duration: 90, Positions: 'Commentator' },
    ]);

    const res = await request(app)
      .post('/api/production/1/callsheets/import-excel')
      .attach('file', buf, { filename: 'template.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .field('name', 'Imported CS')
      .field('color', '#123456');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toBe(2);
    expect(res.body.callSheet).toBeTruthy();
    expect(res.body.callSheet.name).toBe('Imported CS');
    expect(Array.isArray(res.body.problems)).toBe(true);
    expect(res.body.problems.length).toBe(0);
  });

  it('returns problems for unknown segment and skips invalid rows', async () => {
    const buf = await makeWorkbookBuffer([
      { Segment: 'UnknownSeg', Cue: 'C', Title: 'T', Duration: '10' },
      { Segment: 'Opbouw', Cue: '', Title: 'No cue', Duration: '10' }, // missing cue
      { Segment: 'Opbouw', Cue: 'OK', Title: 'Valid', Duration: '15' },
    ]);

    const res = await request(app)
      .post('/api/production/1/callsheets/import-excel')
      .attach('file', buf, { filename: 'template.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toBe(1);
    expect(res.body.problems.length).toBeGreaterThanOrEqual(2);
  });
});
