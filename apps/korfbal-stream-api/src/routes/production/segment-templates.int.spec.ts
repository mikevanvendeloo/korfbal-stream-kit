import request from 'supertest';
import app from '../../main';
import {beforeEach, describe, expect, it} from 'vitest';
import {PrismaClient} from '@prisma/client';

const runDb = process.env.REQUIRE_DB === 'true';
const prisma = new PrismaClient();

async function resetDb() {
  await prisma.$transaction([
    prisma.segmentTemplateItem.deleteMany({}),
    prisma.segmentTemplate.deleteMany({}),
    prisma.segmentRoleAssignment.deleteMany({}),
    prisma.productionSegment.deleteMany({}),
    prisma.production.deleteMany({}),
    prisma.matchSchedule.deleteMany({}),
  ]);
}

describe.runIf(runDb)('Segment Templates API (integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('manages segment templates and items', async () => {
    // 1. Create template
    const createRes = await request(app)
      .post('/api/production/segment-templates')
      .send({ name: 'Test Template' });
    expect(createRes.status).toBe(201);
    const templateId = createRes.body.id;

    // 2. Add items
    const addItem1 = await request(app)
      .post(`/api/production/segment-templates/${templateId}/items`)
      .send({ naam: 'Segment 1', duurInMinuten: 10, isTimeAnchor: true });
    expect(addItem1.status).toBe(201);

    const addItem2 = await request(app)
      .post(`/api/production/segment-templates/${templateId}/items`)
      .send({ naam: 'Segment 2', duurInMinuten: 20, isTimeAnchor: false });
    expect(addItem2.status).toBe(201);

    // 3. List templates
    const listRes = await request(app).get('/api/production/segment-templates');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);
    const template = listRes.body.find((t: any) => t.id === templateId);
    expect(template.items.length).toBe(2);
    expect(template.items[0].volgorde).toBe(1);
    expect(template.items[1].volgorde).toBe(2);

    // 4. Update item order
    const updateItemRes = await request(app)
      .put(`/api/production/segment-templates/items/${addItem2.body.id}`)
      .send({ volgorde: 1 });
    expect(updateItemRes.status).toBe(200);

    const getTemplateRes = await request(app).get(`/api/production/segment-templates/${templateId}`);
    expect(getTemplateRes.body.items[0].naam).toBe('Segment 2');
    expect(getTemplateRes.body.items[1].naam).toBe('Segment 1');

    // 5. Apply to production
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-test-apply',
        date: new Date(),
        homeTeamName: 'Home',
        awayTeamName: 'Away',
        isHomeMatch: true,
      },
    });
    const prod = await prisma.production.create({
      data: { matchScheduleId: match.id }
    });

    const applyRes = await request(app)
      .post(`/api/production/segment-templates/apply/${templateId}/to/${prod.id}`);
    expect(applyRes.status).toBe(200);

    const segments = await prisma.productionSegment.findMany({
      where: { productionId: prod.id },
      orderBy: { volgorde: 'asc' }
    });
    expect(segments.length).toBe(2);
    expect(segments[0].naam).toBe('Segment 2');
    expect(segments[1].naam).toBe('Segment 1');
    expect(segments[1].isTimeAnchor).toBe(true);
  });
});
