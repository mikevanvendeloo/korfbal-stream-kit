import request from 'supertest';
import {afterAll, describe, expect, it} from 'vitest';
import app from '../main';
import {withoutOrganization, testDb as prisma} from '../../test-helpers';
import {runWithOrganization} from '../services/organizationContext';
import {standardPositions, standardSkills, standardTitles} from '../standardSet/data';
import {standardCallSheetTemplates} from '../standardSet/callSheetTemplates';
import {standardSegmentTemplates} from '../standardSet/segmentTemplates';

const runDb = process.env.REQUIRE_DB === 'true';
const SLUG = 'org-api-test';

describe.runIf(runDb)('Organizations API (integration)', () => {
  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: [SLUG, `${SLUG}-2`]}}});
    await prisma.club.deleteMany({where: {slug: 'org-api-test-club'}});
  });

  it('creates an organization with the standard set, linked to a club', async () => {
    const club = await prisma.club.create({data: {name: 'Org Club', shortName: 'OC', slug: 'org-api-test-club', logoUrl: 'clubs/org-club.png'}});
    const res = await withoutOrganization(request(app).post('/api/organizations').send({name: 'Org Test', slug: SLUG, clubId: club.id}));
    expect(res.status, res.text).toBe(201);
    expect(res.body).toMatchObject({slug: SLUG, name: 'Org Test', isActive: true, clubId: club.id, logoUrl: null, displayLogoUrl: 'clubs/org-club.png', initials: 'OT'});

    await runWithOrganization(res.body.id, async () => {
      expect(await prisma.skill.count()).toBe(standardSkills.length);
      expect(await prisma.position.count()).toBe(standardPositions.length);
      expect(await prisma.positionLink.count()).toBeGreaterThan(0);
      expect(await prisma.titleDefinition.count({where: {productionId: null}})).toBe(standardTitles.length);
      expect((await prisma.callSheetTemplate.findMany()).map((t) => t.name).sort()).toEqual(standardCallSheetTemplates.map((t) => t.name).sort());
      expect((await prisma.segmentTemplate.findMany()).map((t) => t.name).sort()).toEqual(standardSegmentTemplates.map((t) => t.name).sort());
      expect(await prisma.segmentTemplate.count({where: {isDefault: true}})).toBe(1);
      // Template items keep their positions and parent links
      const draaiboek = await prisma.callSheetTemplate.findFirstOrThrow({where: {name: 'Draaiboek Korfbal League wedstrijd'}, include: {items: {include: {positions: true}}}});
      expect(draaiboek.items.length).toBe(61);
      expect(draaiboek.items.every((i) => i.positions.length > 0)).toBe(true);
      expect(draaiboek.items.some((i) => i.parentId)).toBe(true);
    });

    // The new organization can be used right away
    expect((await request(app).get('/api/production/positions').set('X-Organization', SLUG)).body.length).toBe(standardPositions.length);
  });

  it('refuses a slug that is taken or invalid, and an unknown club', async () => {
    expect((await request(app).post('/api/organizations').send({name: 'Dubbel', slug: SLUG})).status).toBe(409);
    expect((await request(app).post('/api/organizations').send({name: 'Fout', slug: 'met spatie'})).status).toBe(400);
    expect((await request(app).post('/api/organizations').send({name: 'Club', slug: `${SLUG}-2`, clubId: 999999})).status).toBe(400);
  });

  it('lists active organizations on the start screen, all of them for Beheer', async () => {
    const org = await prisma.organization.findUniqueOrThrow({where: {slug: SLUG}});
    expect((await request(app).put(`/api/organizations/${org.id}`).send({isActive: false})).body.isActive).toBe(false);

    const active = await withoutOrganization(request(app).get('/api/organizations'));
    expect(active.status).toBe(200);
    expect(active.body.map((o: {slug: string}) => o.slug)).not.toContain(SLUG);
    const all = await request(app).get('/api/organizations?all=true');
    expect(all.body.map((o: {slug: string}) => o.slug)).toContain(SLUG);

    // An inactive organization can't be chosen
    expect((await request(app).get('/api/sponsors').set('X-Organization', SLUG)).status).toBe(403);

    const renamed = await request(app).put(`/api/organizations/${org.id}`).send({isActive: true, name: 'Org Hernoemd'});
    expect(renamed.body).toMatchObject({isActive: true, name: 'Org Hernoemd', initials: 'OH'});
    expect((await request(app).get(`/api/organizations/${org.id}`)).body.name).toBe('Org Hernoemd');
    expect((await request(app).get('/api/organizations/999999')).status).toBe(404);
  });

  it('removes an uploaded logo again (back to the club logo)', async () => {
    const org = await prisma.organization.findUniqueOrThrow({where: {slug: SLUG}});
    await prisma.organization.update({where: {id: org.id}, data: {logoUrl: 'organizations/org-api-test.png'}});
    const res = await request(app).delete(`/api/organizations/${org.id}/logo`);
    expect(res.body).toMatchObject({logoUrl: null, displayLogoUrl: 'clubs/org-club.png'});
  });
});
