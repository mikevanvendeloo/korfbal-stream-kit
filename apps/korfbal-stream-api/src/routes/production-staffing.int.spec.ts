import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ensureOrganization, ProductionScenario} from '../../test-scenarios';
import {recordQueries, testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

type ListedProduction = {
  id: number;
  staffing: {presentCount: number; met: boolean; shortfall: Array<{key: string; missing: number}>; roles: Array<{key: string; filled: number; met: boolean}>};
};

/**
 * GET /api/production: the "Bezetting" column of Beheer → Producties. Every production carries the
 * minimum staffing of the people present (domain/minimumStaffing.ts), computed for all at once.
 */
describe.runIf(runDb)('productions list: minimum staffing (integration)', () => {
  const MARK = `Staff${Date.now()}`;
  const shows: ProductionScenario[] = [];
  let full: ProductionScenario;
  let short: ProductionScenario;
  let empty: ProductionScenario;
  let seasonId: number;

  beforeAll(async () => {
    // One after another: a skill code the organization lacks is created by the first scenario
    full = await createProductionScenario(prisma, {
      crew: [
        {name: `${MARK} Regie`, skills: ['REGISSEUR'], present: true},
        {name: `${MARK} Cam 1`, skills: ['CAMERA_ZOOM'], present: true},
        {name: `${MARK} Cam 2`, skills: ['CAMERA_ZOOM'], present: true},
        {name: `${MARK} Cam 3`, skills: ['CAMERA_OVERVIEW'], present: true},
      ],
    });
    shows.push(full);
    short = await createProductionScenario(prisma, {
      crew: [
        {name: `${MARK} Kort regie`, skills: ['REGISSEUR'], present: true},
        {name: `${MARK} Kort cam`, skills: ['CAMERA_ZOOM'], present: true},
        {name: `${MARK} Kort thuis`, skills: ['CAMERA_ZOOM'], present: false},
      ],
    });
    shows.push(short);
    empty = await createProductionScenario(prisma, {});
    shows.push(empty);
    seasonId = (await prisma.matchSchedule.findUniqueOrThrow({where: {id: full.matchId}})).seasonId;
  });

  afterAll(async () => {
    // Reverse order: the first scenario removes the skills it created
    for (const show of [...shows].reverse()) await show.cleanup();
  });

  const list = async (slug?: string) => {
    const req = request(app).get(`/api/production?seasonId=${seasonId}`);
    const res = await (slug ? req.set('X-Organization', slug) : req);
    expect(res.status).toBe(200);
    return res.body.items as ListedProduction[];
  };
  const byId = (items: ListedProduction[], id: number) => items.find((p) => p.id === id);

  it('gives every production its staffing summary', async () => {
    const items = await list();
    expect(byId(items, full.productionId)?.staffing).toMatchObject({presentCount: 4, met: true, shortfall: []});
    expect(byId(items, short.productionId)?.staffing).toMatchObject({
      presentCount: 2,
      met: false,
      shortfall: [{key: 'camera', missing: 2, singular: 'camera', plural: "camera's"}],
    });
    expect(byId(items, short.productionId)?.staffing.roles).toContainEqual(expect.objectContaining({key: 'regisseur', filled: 1, met: true}));
    expect(byId(items, empty.productionId)?.staffing).toMatchObject({presentCount: 0, met: false});
    // Compact: no person ids or skill codes in the list
    expect(JSON.stringify(byId(items, full.productionId)?.staffing)).not.toContain('personIds');
  });

  it('follows a person marked present', async () => {
    const personId = short.personIds[`${MARK} Kort thuis`];
    const added = await request(app).post(`/api/production/${short.productionId}/persons`).send({personId}).expect(201);
    try {
      expect(byId(await list(), short.productionId)?.staffing.shortfall).toEqual([expect.objectContaining({key: 'camera', missing: 1})]);
    } finally {
      await request(app).delete(`/api/production/${short.productionId}/persons/${added.body.id}`).expect(204);
    }
  });

  it('reads the people present of all productions in one query, however many productions there are', async () => {
    const presenceQueries = (queries: string[]) => queries.filter((q) => /FROM "public"\."ProductionPerson"/.test(q));
    const withAll = await recordQueries(() => list());
    expect(presenceQueries(withAll)).toHaveLength(1);

    // Two more productions with people present: not one query more
    const extra = [
      await createProductionScenario(prisma, {crew: [{name: `${MARK} Extra 1`, skills: ['REGISSEUR'], present: true}]}),
      await createProductionScenario(prisma, {crew: [{name: `${MARK} Extra 2`, skills: ['CAMERA_ZOOM'], present: true}]}),
    ];
    try {
      const withMore = await recordQueries(() => list());
      expect(presenceQueries(withMore)).toHaveLength(1);
      expect(withMore.length).toBe(withAll.length);
    } finally {
      for (const show of extra.reverse()) await show.cleanup();
    }
  });

  it("never counts another organization's people (security)", async () => {
    const otherSlug = 'staffing-other';
    const otherId = await ensureOrganization(prisma, otherSlug, 'Staffing Other');
    const other = await createProductionScenario(prisma, {
      organizationId: otherId,
      crew: [
        {name: `${MARK} Ander regie`, skills: ['REGISSEUR'], present: true},
        {name: `${MARK} Ander cam 1`, skills: ['CAMERA_ZOOM'], present: true},
        {name: `${MARK} Ander cam 2`, skills: ['CAMERA_ZOOM'], present: true},
        {name: `${MARK} Ander cam 3`, skills: ['CAMERA_ZOOM'], present: true},
      ],
    });
    try {
      // The own list: the other production is left out and our summaries stay as they were
      const own = await list();
      expect(byId(own, other.productionId)).toBeUndefined();
      expect(byId(own, short.productionId)?.staffing).toMatchObject({presentCount: 2, met: false});
      expect(byId(own, empty.productionId)?.staffing.presentCount).toBe(0);

      // The other organization sees only its own production and people
      const theirs = await list(otherSlug);
      expect(theirs.map((p) => p.id)).toEqual([other.productionId]);
      expect(byId(theirs, other.productionId)?.staffing).toMatchObject({presentCount: 4, met: true});

      // Someone of the other organization can't be marked present at our production either
      const foreignPerson = other.personIds[`${MARK} Ander regie`];
      const res = await request(app).post(`/api/production/${empty.productionId}/persons`).send({personId: foreignPerson});
      expect(res.status).toBe(404);
      expect(byId(await list(), empty.productionId)?.staffing.presentCount).toBe(0);
    } finally {
      await other.cleanup();
      await prisma.organization.deleteMany({where: {id: otherId}});
    }
  });
});
