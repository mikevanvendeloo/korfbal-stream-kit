import request from 'supertest';
import ExcelJS from 'exceljs';
import {afterEach, describe, expect, it} from 'vitest';
import app from '../../main';
import {createProductionScenario, ProductionScenario} from '../../../test-scenarios';
import {testDb as prisma} from '../../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

type Flagged = {title: string; isMatchPart: boolean; showVenueClock: boolean};
const flags = (rows: Flagged[]) => [...rows].sort((a, b) => a.title.localeCompare(b.title)).map((r) => [r.title, r.isMatchPart, r.showVenueClock]);
const EXPECTED = [['MP Eerste helft', true, true], ['MP Klok zonder deel', false, true], ['MP Voorbeschouwing', false, false]];

describe.runIf(runDb)('match parts and venue clock travel with the item (integration)', () => {
  const productionIds: number[] = [];
  const templateIds: number[] = [];
  let show: ProductionScenario | undefined;

  afterEach(async () => {
    await prisma.production.deleteMany({where: {id: {in: productionIds.splice(0)}}});
    await prisma.callSheetTemplate.deleteMany({where: {id: {in: templateIds.splice(0)}}});
    await show?.cleanup();
    show = undefined;
  });

  const scenarioItems = [
    {title: 'MP Voorbeschouwing'},
    {title: 'MP Eerste helft', isMatchPart: true, showVenueClock: true},
    {title: 'MP Klok zonder deel', showVenueClock: true},
  ];

  async function makeTemplate() {
    const template = await prisma.callSheetTemplate.create({data: {name: `Test MP Template ${Date.now()}`}});
    templateIds.push(template.id);
    const chapter = await prisma.callSheetTemplateChapter.create({data: {templateId: template.id, name: 'Draaiboek', orderIndex: 0}});
    await prisma.callSheetTemplateItem.createMany({data: [
      {title: 'MP Voorbeschouwing', durationSec: 300, orderIndex: 1},
      {title: 'MP Eerste helft', durationSec: 2100, orderIndex: 2, isMatchPart: true, showVenueClock: true},
      {title: 'MP Klok zonder deel', durationSec: 60, orderIndex: 3, showVenueClock: true},
    ].map((i) => ({...i, templateId: template.id, chapterId: chapter.id}))});
    return template;
  }

  it('defaults both fields to false', async () => {
    const template = await makeTemplate();
    const res = await request(app).post(`/api/callsheets/templates/${template.id}/items`).send({title: 'MP Nieuw', durationSec: 10});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({isMatchPart: false, showVenueClock: false});
  });

  it('template item CRUD stores the fields', async () => {
    const template = await makeTemplate();
    const created = await request(app).post(`/api/callsheets/templates/${template.id}/items`).send({title: 'MP Nieuw', durationSec: 10, isMatchPart: true, showVenueClock: true});
    expect(created.body).toMatchObject({isMatchPart: true, showVenueClock: true});
    const updated = await request(app).put(`/api/callsheets/templates/items/${created.body.id}`).send({isMatchPart: false});
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({isMatchPart: false, showVenueClock: true});
  });

  it('template -> production callsheet -> live events', async () => {
    const template = await makeTemplate();
    show = await createProductionScenario(prisma, {items: []});
    const res = await request(app).post(`/api/callsheets/templates/${template.id}/apply/${show.productionId}`);
    expect(res.status).toBe(200);
    const items = await prisma.callSheetItem.findMany({where: {callSheet: {productionId: show.productionId}}});
    const events = await prisma.productionEvent.findMany({where: {productionId: show.productionId}});
    expect(flags(items)).toEqual(EXPECTED);
    expect(flags(events)).toEqual(EXPECTED);
  });

  it('production callsheet item CRUD stores the fields', async () => {
    show = await createProductionScenario(prisma, {items: [{title: 'MP Basis'}], callSheet: true});
    const callSheetId = (await prisma.callSheetItem.findUniqueOrThrow({where: {id: show.callSheetItemIds[0]}})).callSheetId;
    const created = await request(app).post(`/api/production/callsheets/${callSheetId}/items`)
      .send({title: 'MP Nieuw', durationSec: 10, chapterId: show.chapterIds[0], isMatchPart: true, showVenueClock: true});
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({isMatchPart: true, showVenueClock: true});
    const updated = await request(app).put(`/api/production/callsheet-items/${created.body.id}`).send({showVenueClock: false});
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({isMatchPart: true, showVenueClock: false});
  });

  it('production export -> import keeps the fields, an old export reads as false', async () => {
    show = await createProductionScenario(prisma, {items: scenarioItems, callSheet: true});
    const exported = (await request(app).get(`/api/production/${show.productionId}/export`)).body;

    const importOf = async (data: unknown) => {
      const res = await request(app).post('/api/production/import').send(data);
      expect(res.status).toBe(200);
      productionIds.push(res.body.id);
      return {
        items: await prisma.callSheetItem.findMany({where: {callSheet: {productionId: res.body.id}}}),
        events: await prisma.productionEvent.findMany({where: {productionId: res.body.id}}),
      };
    };

    const full = await importOf(exported);
    expect(flags(full.items)).toEqual(EXPECTED);
    expect(flags(full.events)).toEqual(EXPECTED);

    const old = JSON.parse(JSON.stringify(exported));
    for (const row of [...(old.callSheets ?? []).flatMap((c: {items: object[]}) => c.items), ...(old.events ?? old.productionEvents ?? [])]) {
      delete (row as Record<string, unknown>).isMatchPart;
      delete (row as Record<string, unknown>).showVenueClock;
    }
    const legacy = await importOf(old);
    expect(legacy.events.length).toBeGreaterThan(0);
    expect(flags(legacy.items).every(([, mp, vc]) => mp === false && vc === false)).toBe(true);
    expect(flags(legacy.events).every(([, mp, vc]) => mp === false && vc === false)).toBe(true);
  });

  it('template Excel: two columns at the end; a file without them imports as NEE', async () => {
    const template = await makeTemplate();
    const res = await request(app).get(`/api/callsheets/templates/${template.id}/export`).buffer(true).parse((r, done) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => done(null, Buffer.concat(chunks)));
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet(1)!;
    const header = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
    expect(header.slice(0, 11)).toEqual(['Volgorde', 'Titel', 'Notitie', 'Duur (sec)', 'Tijd Anchor', 'Anchor Type', 'Auto Advance', 'Zaal (inVenue)', 'Stream (inStream)', 'Hoofdstuk', 'Cue']);
    expect(header.slice(-2)).toEqual(['Wedstrijddeel', 'Zaalklok']);

    const importXlsx = async (buffer: Buffer, name: string) => {
      const r = await request(app).post('/api/callsheets/templates/import').field('name', name).attach('file', buffer, 'x.xlsx');
      expect(r.status).toBe(201);
      templateIds.push(r.body.id);
      return prisma.callSheetTemplateItem.findMany({where: {templateId: r.body.id}});
    };
    expect(flags(await importXlsx(Buffer.from(res.body), `Test MP Import ${Date.now()}`))).toEqual(EXPECTED);

    sheet.spliceColumns(header.length - 1, 2);
    const without = Buffer.from(await workbook.xlsx.writeBuffer());
    expect(flags(await importXlsx(without, `Test MP Import oud ${Date.now()}`)).every(([, mp, vc]) => mp === false && vc === false)).toBe(true);
  });
});
