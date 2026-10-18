import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ensureOrganization, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

type AttendancePerson = {id: number; name: string; group: string; productionPersonId: number | null; skills: {code: string}[]};

/**
 * GET /api/production/:id/attendance: the Beschikbaarheid tab. Groups come from the categories of the
 * organization's own positions; the minimum staffing counts the people present.
 */
describe.runIf(runDb)('production attendance (integration)', () => {
  let show: ProductionScenario;
  const MARK = `Att${Date.now()}`;

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      // Codes of its own: the categories come from the positions made for them, not from the standard set
      skillCategories: {[`${MARK}_PRES`]: 'ENTERTAINMENT', [`${MARK}_COMM`]: 'ENTERTAINMENT', [`${MARK}_RUN`]: 'GENERAL'},
      crew: [
        {name: `${MARK} Presentator`, skills: [`${MARK}_PRES`, `${MARK}_COMM`], present: true},
        {name: `${MARK} Gemengd`, skills: [`${MARK}_PRES`, `${MARK}_CAM`]},
        {name: `${MARK} Runner`, skills: [`${MARK}_RUN`]},
        {name: `${MARK} Zonder`},
      ],
    });
  });

  afterAll(async () => {
    await show.cleanup();
  });

  const get = (id = show.productionId) => request(app).get(`/api/production/${id}/attendance`);
  const mine = (persons: AttendancePerson[]) => persons.filter((p) => p.name.startsWith(MARK));

  it('lists every person with the group derived from the positions of their skills', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const groups = Object.fromEntries(mine(res.body.persons).map((p: AttendancePerson) => [p.name.slice(MARK.length + 1), p.group]));
    expect(groups).toEqual({Presentator: 'entertainment', Gemengd: 'crew', Runner: 'crew', Zonder: 'crew'});
    const presenter = mine(res.body.persons).find((p: AttendancePerson) => p.name.endsWith('Presentator'));
    expect(presenter.productionPersonId).toEqual(expect.any(Number));
    expect(presenter.skills.map((s: {code: string}) => s.code).sort()).toEqual([`${MARK}_COMM`, `${MARK}_PRES`]);
  });

  it('follows a renamed position category', async () => {
    const position = await prisma.position.findFirstOrThrow({where: {skill: {code: `${MARK}_RUN`}}});
    await prisma.position.update({where: {id: position.id}, data: {category: 'ENTERTAINMENT'}});
    try {
      const runner = mine((await get()).body.persons).find((p) => p.name.endsWith('Runner'));
      expect(runner?.group).toBe('entertainment');
    } finally {
      await prisma.position.update({where: {id: position.id}, data: {category: 'GENERAL'}});
    }
  });

  it('lists more than 100 people (no paging)', async () => {
    const before = (await get()).body.persons.length;
    const extra = await prisma.person.createManyAndReturn({
      data: Array.from({length: 101}, (_, i) => ({name: `${MARK} Extra ${i}`, gender: 'male' as const})),
    });
    try {
      expect((await get()).body.persons.length).toBe(before + 101);
    } finally {
      await prisma.person.deleteMany({where: {id: {in: extra.map((p) => p.id)}}});
    }
  });

  it('returns the minimum staffing of the people present, each person counted once', async () => {
    expect((await get()).body.staffing).toMatchObject({met: false, shortfall: [{key: 'regisseur', missing: 1}, {key: 'camera', missing: 3}]});

    const crew = await createProductionScenario(prisma, {
      crew: [
        {name: `${MARK} Regie en camera`, skills: ['REGISSEUR', 'CAMERA_ZOOM'], present: true},
        {name: `${MARK} Camera 1`, skills: ['CAMERA_ZOOM'], present: true},
        {name: `${MARK} Camera 2`, skills: ['CAMERA_OVERVIEW'], present: true},
        {name: `${MARK} Camera 3`, skills: ['CAMERA_ZOOM'], present: false},
      ],
    });
    try {
      const staffing = (await get(crew.productionId)).body.staffing;
      expect(staffing.met).toBe(false);
      expect(staffing.shortfall).toEqual([{key: 'camera', missing: 1, singular: 'camera', plural: "camera's"}]);
      expect(staffing.roles[0]).toMatchObject({key: 'regisseur', filled: 1, personIds: [crew.personIds[`${MARK} Regie en camera`]]});

      await request(app).post(`/api/production/${crew.productionId}/persons`).send({personId: crew.personIds[`${MARK} Camera 3`]}).expect(201);
      expect((await get(crew.productionId)).body.staffing).toMatchObject({met: true, shortfall: []});
    } finally {
      await crew.cleanup();
    }
  });

  it('answers 404 for a production of another organization (security)', async () => {
    const otherId = await ensureOrganization(prisma, 'att-other', 'Att Other');
    const other = await createProductionScenario(prisma, {organizationId: otherId, crew: [{name: `${MARK} Ander`, present: true}]});
    try {
      expect((await get(other.productionId)).status).toBe(404);
      // And the own list never shows the other organization's people
      expect(mine((await get()).body.persons).some((p) => p.name.endsWith('Ander'))).toBe(false);
    } finally {
      await other.cleanup();
      await prisma.organization.deleteMany({where: {id: otherId}});
    }
  });
});
