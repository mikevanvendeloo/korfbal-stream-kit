import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as XLSX from 'xlsx';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

function makeWorkbookBuffer(rows: Array<Record<string, any>>): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sponsors');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as any as Buffer;
  return buf;
}

describe('Sponsors Excel upload API', () => {
  beforeEach(() => {
    const store: any[] = [];
    prisma.sponsor = {
      findFirst: vi.fn(async ({ where }: any) => store.find((s) => s.name === where.name) || null),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: store.length + 1, createdAt: new Date(), ...data };
        store.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = store.findIndex((s) => s.id === where.id);
        if (idx >= 0) {
          store[idx] = { ...store[idx], ...data };
          return store[idx];
        }
        throw new Error('Not found');
      }),
      findMany: vi.fn(async () => store),
      count: vi.fn(async () => store.length),
      deleteMany: vi.fn(async () => { store.length = 0; return { count: 0 }; }),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('imports sponsors from uploaded Excel and returns created/updated counts', async () => {
    const buf = makeWorkbookBuffer([
      { Name: 'Alpha BV', Type: 'Premium', Website: 'https://alpha.example', Logo: 'alpha.png' },
      { Name: 'Beta Co', Type: 'Goud', Website: 'https://beta.example' }, // no logo -> auto
      { Name: 'Bad Row', Type: 'Unknown', Website: 'https://x' }, // will be skipped due to type
      // Spaced headers variant to verify header normalization works (e.g., "Sponsor package", "Website URL")
      { Name: 'Gamma N.V.', 'Sponsor package': 'Brons', 'Website URL': 'https://gamma.example', 'Logo file name': 'gamma' },
      // Labels-only type should be accepted (labels represents the sponsor type)
      { Name: 'LabelOnly BV', Labels: 'Zilver', Website: 'https://labelonly.example' },
    ]);

    const res = await request(app)
      .post('/api/sponsors/upload-excel')
      .attach('file', buf, { filename: 'sponsors.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toBe(4);
    expect(res.body.updated).toBe(0);
    expect(Array.isArray(res.body.problems)).toBe(true);
    // Should include at least one problem (bad row)
    expect(res.body.problems.length).toBeGreaterThanOrEqual(1);

    // Re-upload with changed Beta Co website -> should update
    const buf2 = makeWorkbookBuffer([
      { Name: 'Alpha BV', Type: 'Premium', Website: 'https://alpha.example' },
      { Name: 'Beta Co', Type: 'Goud', Website: 'https://beta.example/changed' },
    ]);
    const res2 = await request(app)
      .post('/api/sponsors/upload-excel')
      .attach('file', buf2, { filename: 'sponsors.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res2.status).toBe(200);
    expect(res2.body.updated).toBe(2);
  });

  it('imports Dutch headers and stores categories field', async () => {
    const buf = makeWorkbookBuffer([
      { 'Sponsorcategorieën': 'Hoofdsponsor; Premium', Naam: 'Delta BV', Website: 'https://delta.example', Labels: 'Zilver' },
      { 'Sponsorcategorieën': 'Partner', Naam: 'Epsilon', Website: 'https://epsi.example' },
    ]);

    const res = await request(app)
      .post('/api/sponsors/upload-excel')
      .attach('file', buf, { filename: 'sponsors.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toBe(2);

    // Fetch list and ensure categories are present
    const list = await request(app).get('/api/sponsors?limit=100');
    expect(list.status).toBe(200);
    const delta = list.body.items.find((s: any) => s.name === 'Delta BV');
    const epsilon = list.body.items.find((s: any) => s.name === 'Epsilon');
    expect(delta).toBeTruthy();
    expect(epsilon).toBeTruthy();
    expect(delta.categories).toBe('Hoofdsponsor; Premium');
    expect(typeof epsilon.categories === 'string' || epsilon.categories === null).toBe(true);
  });

  it('normalizes logo filenames during Excel import (ampersand, slashes, diacritics)', async () => {
    const buf = makeWorkbookBuffer([
      { Name: 'A and B', Labels: 'Brons', Website: 'https://ab.example', Logo: 'A&B.png' },
      { Name: 'Weird', Labels: 'Brons', Website: 'https://weird.example', Logo: 'weird/\\name.jpeg' },
      { Name: 'Cafe', Labels: 'Brons', Website: 'https://cafe.example', Logo: 'Café.svg' },
    ]);

    const res = await request(app)
      .post('/api/sponsors/upload-excel')
      .attach('file', buf, { filename: 'sponsors.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toBe(3);

    const list = await request(app).get('/api/sponsors?limit=100');
    expect(list.status).toBe(200);

    const aAndB = list.body.items.find((s: any) => s.name === 'A and B');
    const weird = list.body.items.find((s: any) => s.name === 'Weird');
    const cafe = list.body.items.find((s: any) => s.name === 'Cafe');

    expect(aAndB.logoUrl).toBe('a-en-b.png');
    expect(weird.logoUrl).toBe('weirdname.png');
    expect(cafe.logoUrl).toBe('cafe.png');
  });
});


it('overwrites logo when only case changes on re-import (derive lower-case from name)', async () => {
  // First create via API with mixed-case derived logo (preserves casing)
  const createRes = await request(app).post('/api/sponsors').send({ name: 'ACME BV', type: 'premium', websiteUrl: 'https://acme.example' });
  expect(createRes.status).toBe(201);
  expect(createRes.body.logoUrl).toBe('acme-bv.png');

  // Now upload Excel without Logo column; import should derive lowercased filename and update existing row
  const buf = makeWorkbookBuffer([
    { Name: 'ACME BV', Labels: 'Premium', Website: 'https://acme.example' },
  ]);

  const res = await request(app)
    .post('/api/sponsors/upload-excel')
    .attach('file', buf, { filename: 'sponsors.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  expect(res.status).toBe(200);
  expect(res.body.updated).toBe(1);

  const list = await request(app).get('/api/sponsors?limit=100');
  expect(list.status).toBe(200);
  const acme = list.body.items.find((s: any) => s.name === 'ACME BV');
  expect(acme.logoUrl).toBe('acme-bv.png');
});
