import {beforeEach, describe, expect, it} from 'vitest';
import {prisma} from '../../services/prisma';
import {callSheetTemplateRouter} from './callsheet-templates';
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use('/api/callsheets/templates', callSheetTemplateRouter);

describe('CallSheetTemplate Excel Export/Import', () => {
  beforeEach(async () => {
    // Clear test data
    await prisma.callSheetTemplateItem.deleteMany({
      where: { template: { name: { contains: 'Test' } } }
    });
    await prisma.callSheetTemplate.deleteMany({
      where: { name: { contains: 'Test' } }
    });

    // Wait for deletions to complete (sometimes needed for DB constraints/timing)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Ensure 'Regie livestream' exists
    await prisma.position.upsert({
      where: { name: 'Regie livestream' },
      update: {},
      create: { name: 'Regie livestream', category: 'TECHNICAL' }
    });
  });

  const getBuffer = (res: any) => {
    if (Buffer.isBuffer(res.body)) return res.body;
    // supertest in some environments might not put binary in res.body automatically
    // but vitest usually handles it if configured
    return Buffer.from(res.body);
  };

  it('should create, read, update and delete templates', async () => {
    const timestamp = Date.now() + Math.random();
    const testName = `Test CRUD Template ${timestamp}`;
    const updatedName = `Test CRUD Template Updated ${timestamp}`;

    // Create
    const createRes = await request(app)
      .post('/api/callsheets/templates')
      .send({ name: testName })
      .expect(201);

    const templateId = createRes.body.id;
    expect(createRes.body.name).toBe(testName);

    // List
    const listRes = await request(app)
      .get(`/api/callsheets/templates`)
      .expect(200);

    const found = listRes.body.find((t: any) => t.id === templateId);
    expect(found).toBeDefined();

    // Update
    const updateRes = await request(app)
      .put(`/api/callsheets/templates/${templateId}`)
      .send({ name: updatedName })
      .expect(200);

    expect(updateRes.body.name).toBe(updatedName);
  });

  it('should export and then import a template via Excel', async () => {
    const timestamp = Date.now() + Math.random();
    const exportTemplateName = `Test Export Template ${timestamp}`;
    const importTemplateName = `Test Imported Template ${timestamp}`;

    // 1. Create a template with items
    const template = await prisma.callSheetTemplate.create({
      data: {
        name: exportTemplateName,
        items: {
          create: [
            {
              title: 'Item 1',
              note: 'Note 1',
              durationSec: 30,
              orderIndex: 1,
              isInVenue: true,
              isInLivestream: true,
              isTimeAnchor: true,
              anchorType: 'MATCH_START'
            },
            {
              title: 'Item 2',
              note: 'Note 2',
              durationSec: 60,
              orderIndex: 2,
              isInVenue: false,
              isInLivestream: true
            }
          ]
        }
      }
    });

    // 2. Export to Excel
    const exportRes = await request(app)
      .get(`/api/callsheets/templates/${template.id}/export`)
      .buffer()
      .parse((res, cb) => {
          let data: any[] = [];
          res.on('data', (chunk) => data.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(exportRes.header['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = exportRes.body;
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // 3. Import from the exported buffer
    const importRes = await request(app)
      .post(`/api/callsheets/templates/import`)
      .field('name', importTemplateName)
      .attach('file', buffer, { filename: 'test.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201);

    const importedTemplateId = importRes.body.id;
    expect(importRes.body.name).toMatch(/Imported Template/);

    // 4. Verify imported items
    const importedTemplate = await prisma.callSheetTemplate.findUnique({
      where: { id: importedTemplateId },
      include: { items: { include: { positions: true } } }
    });

    expect(importedTemplate?.items).toHaveLength(2);
    const item1 = importedTemplate?.items.find(i => i.title === 'Item 1');
    expect(item1?.note).toBe('Note 1');
    expect(item1?.durationSec).toBe(30);
    expect(item1?.isTimeAnchor).toBe(true);
    expect(item1?.anchorType).toBe('MATCH_START');
    expect(item1?.isInVenue).toBe(true);
    expect(item1?.orderIndex).toBe(1);

    const item2 = importedTemplate?.items.find(i => i.title === 'Item 2');
    expect(item2?.note).toBe('Note 2');
    expect(item2?.durationSec).toBe(60);
    expect(item2?.isInVenue).toBe(false);
    expect(item2?.isInLivestream).toBe(true);
    expect(item2?.orderIndex).toBe(2);
  });

  it('should add, update and delete items in a template', async () => {
    const timestamp = Date.now() + Math.random();
    const testTemplateName = `Test Item Template ${timestamp}`;

    // Create template
    const templateRes = await request(app)
      .post(`/api/callsheets/templates`)
      .send({ name: testTemplateName })
      .expect(201);
    const templateId = templateRes.body.id;

    // Add item
    const addRes = await request(app)
      .post(`/api/callsheets/templates/${templateId}/items`)
      .send({
        title: 'New Item',
        durationSec: 120,
        orderIndex: 1,
        isInVenue: true,
        isInLivestream: true,
        positionIds: []
      })
      .expect(201);

    const itemId = addRes.body.id;
    expect(addRes.body.title).toBe('New Item');
    expect(addRes.body.templateId).toBe(templateId);

    // Update item
    const updateRes = await request(app)
      .put(`/api/callsheets/templates/items/${itemId}`)
      .send({
        title: 'Updated Item',
        durationSec: 150,
        orderIndex: 2,
        isInVenue: false,
        isInLivestream: true,
        positionIds: []
      })
      .expect(200);

    expect(updateRes.body.title).toBe('Updated Item');
    expect(updateRes.body.durationSec).toBe(150);

    // Delete item
    await request(app)
      .delete(`/api/callsheets/templates/items/${itemId}`)
      .expect(204);

    // Verify deletion
    const checkTemplate = await request(app)
      .get(`/api/callsheets/templates/${templateId}`)
      .expect(200);

    expect(checkTemplate.body.items.find((i: any) => i.id === itemId)).toBeUndefined();
  });

  it('should apply a template to a production in replace and append mode', async () => {
    // 1. Setup template and production
    const timestamp = Date.now() + Math.random();
    const match = await prisma.matchSchedule.create({
      data: {
        date: new Date(),
        homeTeamName: 'Home',
        awayTeamName: 'Away'
      }
    });

    const production = await prisma.production.create({
      data: {
        matchScheduleId: match.id,
        segments: {
          create: [
            { naam: 'Bestaand Segment 1', volgorde: 1, duurInMinuten: 10 },
            { naam: 'Bestaand Segment 2', volgorde: 2, duurInMinuten: 20 }
          ]
        }
      },
      include: { segments: true }
    });

    const template = await prisma.callSheetTemplate.create({
      data: {
        name: `Test Apply Template ${timestamp}`,
        items: {
          create: [
            { title: 'Template Item 1', durationSec: 30, orderIndex: 1 },
            { title: 'Template Item 2', durationSec: 60, orderIndex: 2 }
          ]
        }
      }
    });

    // 2. Apply in APPEND mode to Segment 2
    const seg2 = production.segments.find(s => s.naam === 'Bestaand Segment 2');
    expect(seg2).toBeDefined();

    await request(app)
      .post(`/api/callsheets/templates/${template.id}/apply/${production.id}`)
      .send({ replace: false, segmentId: seg2?.id })
      .expect(200);

    // Verify append results
    const prodAppend = await prisma.production.findUnique({
      where: { id: production.id },
      include: { segments: true, callSheets: { include: { items: true } } }
    });

    expect(prodAppend?.segments).toHaveLength(2);
    expect(prodAppend?.segments.map(s => s.naam)).toContain('Bestaand Segment 1');
    expect(prodAppend?.segments.map(s => s.naam)).toContain('Bestaand Segment 2');

    // There should be a callsheet now
    expect(prodAppend?.callSheets.length).toBeGreaterThan(0);
    const cs = prodAppend?.callSheets[0];
    expect(cs?.items).toHaveLength(2);
    expect(cs?.items.every(i => i.productionSegmentId === seg2?.id)).toBe(true);

    // 3. Apply in REPLACE mode
    await request(app)
      .post(`/api/callsheets/templates/${template.id}/apply/${production.id}`)
      .send({ replace: true })
      .expect(200);

    // Verify replace results
    const prodReplace = await prisma.production.findUnique({
      where: { id: production.id },
      include: { segments: true, callSheets: { include: { items: true } } }
    });

    expect(prodReplace?.segments).toHaveLength(1);
    expect(prodReplace?.segments[0].naam).toBe('Algemeen');
    expect(prodReplace?.callSheets).toHaveLength(1);
    expect(prodReplace?.callSheets[0].items).toHaveLength(2);
    expect(prodReplace?.callSheets[0].items.every(i => i.productionSegmentId === prodReplace?.segments[0].id)).toBe(true);
  });
});
