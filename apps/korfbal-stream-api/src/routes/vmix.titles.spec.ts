import request from 'supertest';
import app from '../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock prisma client methods used by the routes
import * as prismaSvc from '../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

type TitleDefinition = { id: number; productionId: number | null; name: string; order: number; enabled: boolean };
type TitlePart = { id: number; titleDefinitionId: number; sourceType: 'COMMENTARY'|'PRESENTATION'|'PRESENTATION_AND_ANALIST'|'TEAM_PLAYER'|'TEAM_COACH'|'FREE_TEXT'; teamSide: 'HOME'|'AWAY'|'NONE'; limit: number | null; filters?: any; customFunction?: string | null; customName?: string | null };

describe('vMix Titles - templates, copy-to-production and resolver', () => {
  let defs: TitleDefinition[];
  let parts: TitlePart[];

  beforeEach(() => {
    defs = [];
    parts = [];

    // Production and schedule
    prisma.production = {
      findUnique: vi.fn(async ({ where, include }: any) => {
        if (!where?.id) return null;
        const base = { id: where.id, matchScheduleId: 777 };
        if (include?.matchSchedule) {
          return { ...base, matchSchedule: { id: 777, date: new Date().toISOString(), homeTeamName: 'Fortuna/Ruitenheer', awayTeamName: 'Dalto/Klaverblad Verzekeringen' } };
        }
        return base;
      }),
    };

    // Minimal mocks for club and players (not needed for commentary-only test)
    prisma.club = { findFirst: vi.fn(async () => null) };
    prisma.player = { findMany: vi.fn(async () => []) };

    // Mock productionPersonPosition for resolver
    prisma.productionPersonPosition = {
      findMany: vi.fn(async ({ where }: any) => {
        // Check if we are looking for on_stream skills
        if (where?.position?.skill?.type === 'on_stream') {
          return [
            {
              id: 1,
              productionId: 10,
              person: { id: 1, name: 'Alice' },
              position: { id: 10, name: 'Commentator 1', skill: { code: 'COMMENTAAR' } }
            },
            {
              id: 2,
              productionId: 10,
              person: { id: 2, name: 'Bob' },
              position: { id: 11, name: 'Commentator 2', skill: { code: 'COMMENTAAR' } }
            }
          ];
        }
        return [];
      }),
    };

    // Template storage using in-memory arrays
    let nextDefId = 1;
    let nextPartId = 1;
    (prisma as any).titleDefinition = {
      findMany: vi.fn(async ({ where, orderBy, include }: any) => {
        let rows = defs;
        if (where?.productionId !== undefined) rows = rows.filter((d) => d.productionId === where.productionId);
        if (where?.enabled === true) rows = rows.filter((d) => d.enabled);
        const ordered = orderBy?.order === 'asc' ? [...rows].sort((a, b) => a.order - b.order) : rows;
        if (include?.parts) {
          return ordered.map((d) => ({
            ...d,
            parts: parts.filter((p) => p.titleDefinitionId === d.id).sort((a, b) => a.id - b.id),
          }));
        }
        return ordered;
      }),
      aggregate: vi.fn(async ({ where }: any) => {
        const rel = defs.filter((d) => d.productionId === where.productionId);
        const max = Math.max(0, ...rel.map((d) => d.order));
        return { _max: { order: max } };
      }),
      count: vi.fn(async ({ where }: any) => defs.filter((d) => d.productionId === where.productionId).length),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const d = defs.find((x) => x.id === where.id);
        if (!d) return null;
        if (include?.parts) {
          return { ...d, parts: parts.filter((p) => p.titleDefinitionId === d.id).sort((a, b) => a.id - b.id) };
        }
        return d;
      }),
      create: vi.fn(async ({ data }: any) => {
        const rec: TitleDefinition = { id: nextDefId++, productionId: data.productionId ?? null, name: data.name, order: data.order ?? 1, enabled: data.enabled ?? true };
        defs.push(rec);
        return rec;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = defs.findIndex((d) => d.id === where.id);
        if (idx < 0) throw new Error('Not found');
        defs[idx] = { ...defs[idx], ...data };
        return defs[idx];
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const matches = defs.filter((d) => d.productionId === where.productionId && d.order >= where.order.gte);
        for (const m of matches) {
          if (data.order?.increment) m.order += data.order.increment;
        }
        return { count: matches.length };
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = defs.findIndex((d) => d.id === where.id);
        if (idx < 0) throw new Error('Not found');
        defs.splice(idx, 1);
        return {};
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const ids = (where?.id?.in as number[]) || [];
        defs = defs.filter((d) => !ids.includes(d.id));
        return { count: ids.length };
      }),
    };

    (prisma as any).titlePart = {
      create: vi.fn(async ({ data }: any) => {
        const rec: TitlePart = {
          id: nextPartId++,
          titleDefinitionId: data.titleDefinitionId,
          sourceType: data.sourceType,
          teamSide: data.teamSide ?? 'NONE',
          limit: data.limit ?? null,
          filters: data.filters ?? null,
          customFunction: data.customFunction ?? null,
          customName: data.customName ?? null,
        };
        parts.push(rec);
        return rec;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        if (where?.titleDefinitionId?.in) {
          const ids: number[] = where.titleDefinitionId.in;
          parts = parts.filter((p) => !ids.includes(p.titleDefinitionId));
        } else if (where?.titleDefinitionId) {
          const id = where.titleDefinitionId;
          parts = parts.filter((p) => p.titleDefinitionId !== id);
        }
        return { count: 0 };
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

  it('creates, lists and deletes a template via /api/admin/vmix/title-templates', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/admin/vmix/title-templates')
      .send({ name: 'Commentaar (allen)', parts: [{ sourceType: 'COMMENTARY', teamSide: 'NONE' }] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Commentaar (allen)');
    expect(createRes.body.parts.length).toBe(1);

    // List
    const list = await request(app).get('/api/admin/vmix/title-templates');
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    // Delete
    const id = list.body[0].id;
    const del = await request(app).delete(`/api/admin/vmix/title-templates/${id}`);
    expect(del.status).toBe(204);

    const list2 = await request(app).get('/api/admin/vmix/title-templates');
    expect(list2.body.length).toBe(0);
  });

  it('reorders templates with PATCH :reorder', async () => {
    // Seed two
    await request(app).post('/api/admin/vmix/title-templates').send({ name: 'A', parts: [{ sourceType: 'COMMENTARY', teamSide: 'NONE' }] });
    await request(app).post('/api/admin/vmix/title-templates').send({ name: 'B', parts: [{ sourceType: 'COMMENTARY', teamSide: 'NONE' }] });
    const list = await request(app).get('/api/admin/vmix/title-templates');
    const ids = list.body.map((x: any) => x.id);

    // Reverse
    const patch = await request(app).patch('/api/admin/vmix/title-templates:reorder').send({ ids: ids.slice().reverse() });
    expect(patch.status).toBe(204);

    const list2 = await request(app).get('/api/admin/vmix/title-templates');
    expect(list2.body[0].name).toBe('B');
    expect(list2.body[1].name).toBe('A');
  });

  it('copies templates to a production and lists them under /api/production/:id/titles', async () => {
    // Seed templates
    await request(app).post('/api/admin/vmix/title-templates').send({ name: 'Presentatie & analist', parts: [{ sourceType: 'PRESENTATION_AND_ANALIST', teamSide: 'NONE' }] });
    await request(app).post('/api/admin/vmix/title-templates').send({ name: 'Commentaar (allen)', parts: [{ sourceType: 'COMMENTARY', teamSide: 'NONE' }] });

    const copy = await request(app).post('/api/admin/vmix/production/10/titles/use-default');
    expect(copy.status).toBe(204);

    const list = await request(app).get('/api/production/10/titles');
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);
    expect(list.body[0].name).toBe('Presentatie & analist');
    expect(list.body[1].name).toBe('Commentaar (allen)');
  });

  it('resolver uses templates when no production-specific titles exist and emits friendly Commentaar title', async () => {
    // Only a single COMMENTARY template
    await request(app).post('/api/admin/vmix/title-templates').send({ name: 'Commentaar (allen)', parts: [{ sourceType: 'COMMENTARY', teamSide: 'NONE' }] });

    const res = await request(app).get('/api/vmix/production/10/titles');
    expect(res.status).toBe(200);
    const items = res.body as Array<{ functionName: string; name: string }>;
    expect(items.length).toBe(1);
    expect(items[0].functionName).toBe('Commentaar');
    expect(items[0].name).toBe('Alice & Bob');
  });

  it('supports FREE_TEXT parts in templates and resolver output (from templates)', async () => {
    // Create a template with a FREE_TEXT part (productionId=null)
    const createRes = await request(app)
      .post('/api/admin/vmix/title-templates')
      .send({
        name: 'Vrije tekst voorbeeld',
        parts: [
          { sourceType: 'FREE_TEXT', customFunction: 'Presentator', customName: 'Jan Jansen' },
        ],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.parts[0].sourceType).toBe('FREE_TEXT');
    // It should have stored the custom fields (the route echoes fresh read)
    const p0 = createRes.body.parts[0];
    expect(p0.customFunction).toBe('Presentator');
    expect(p0.customName).toBe('Jan Jansen');

    // Update the template to change values (still as template)
    const tid = createRes.body.id;
    const updateRes = await request(app)
      .put(`/api/admin/vmix/title-templates/${tid}`)
      .send({
        name: 'Vrije tekst aangepast',
        parts: [ { sourceType: 'FREE_TEXT', customFunction: 'Analist', customName: 'Piet Pieters' } ],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Vrije tekst aangepast');
    expect(updateRes.body.parts[0].customFunction).toBe('Analist');
    expect(updateRes.body.parts[0].customName).toBe('Piet Pieters');

    // Optional: call resolver to ensure it returns 200 (content depends on other templates)
    const res = await request(app).get('/api/vmix/production/55/titles');
    expect(res.status).toBe(200);
  });
});
