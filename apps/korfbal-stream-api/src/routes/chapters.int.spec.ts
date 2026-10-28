import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
const MARKER = `Hoofdstuk-int-${Date.now()}`;

/** Writing hoofdstukken: templates, applying, productions, save as template, export/import (openspec/changes/chapters D3, D4). */
describe.runIf(runDb)('hoofdstukken of a draaiboek (integration)', () => {
  const templateIds: number[] = [];
  let templateId: number;
  let positionId: number;
  let show: ProductionScenario;
  const chapters: Record<string, string> = {};
  const items: Record<string, string> = {};

  beforeAll(async () => {
    positionId = (await prisma.position.create({data: {name: `${MARKER} Camera`, category: 'TECHNICAL'}})).id;
    const created = await request(app).post('/api/callsheets/templates').send({name: `${MARKER} Draaiboek`}).expect(201);
    templateId = created.body.id;
    templateIds.push(templateId);
    for (const name of ['Voorbereiding', 'Eerste helft', 'Rust']) {
      const res = await request(app).post(`/api/callsheets/templates/${templateId}/chapters`).send({name}).expect(201);
      chapters[name] = res.body.id;
    }
    for (const [title, chapter, durationSec] of [['Kabels checken', 'Voorbereiding', 300], ['Aftrap', 'Eerste helft', 0], ['Eerste helft', 'Eerste helft', 2100], ['Rust', 'Rust', 600]] as const) {
      const cue = title === 'Aftrap' ? 'AFTRAP' : undefined;
      const res = await request(app).post(`/api/callsheets/templates/${templateId}/items`).send({title, durationSec, chapterId: chapters[chapter], cue}).expect(201);
      items[title] = res.body.id;
    }
    // A linked item follows its parent
    const linked = await request(app).post(`/api/callsheets/templates/${templateId}/items`)
      .send({title: 'Camera op middenstip', durationSec: 0, chapterId: chapters['Eerste helft'], parentId: items['Aftrap']}).expect(201);
    items['Camera op middenstip'] = linked.body.id;
    await request(app).put(`/api/callsheets/templates/chapters/${chapters['Eerste helft']}`).send({positionIds: [positionId]}).expect(200);

    show = await createProductionScenario(prisma, {
      items: [], segments: [{naam: 'Eerste helft', duurInMinuten: 35, isTimeAnchor: true}, {naam: 'Oud segment', duurInMinuten: 10}],
      crew: [{name: `${MARKER} Persoon`, skills: []}],
    });
  });

  afterAll(async () => {
    await prisma.callSheetTemplate.deleteMany({where: {id: {in: templateIds}}});
    await show?.cleanup();
    await prisma.position.deleteMany({where: {id: positionId}});
  });

  const template = async (id = templateId) => (await request(app).get(`/api/callsheets/templates/${id}`).expect(200)).body as {
    chapters: Array<{ id: string; name: string; positions: Array<{ positionId: number }> }>;
    items: Array<{ id: string; title: string; chapterId: string; orderIndex: number; cue: string }>;
  };
  const byChapter = (t: Awaited<ReturnType<typeof template>>) =>
    t.chapters.map((c) => [c.name, t.items.filter((i) => i.chapterId === c.id).sort((a, b) => a.orderIndex - b.orderIndex).map((i) => i.title)]);

  describe('template', () => {
    it('gives the hoofdstukken in order, each item in its hoofdstuk, with the standard positions', async () => {
      const t = await template();
      expect(byChapter(t)).toEqual([
        ['Voorbereiding', ['Kabels checken']],
        ['Eerste helft', ['Aftrap', 'Eerste helft', 'Camera op middenstip']],
        ['Rust', ['Rust']],
      ]);
      expect(t.chapters[1].positions.map((p) => p.positionId)).toEqual([positionId]);
    });

    it('puts an item without a hoofdstuk in the hoofdstuk of the last item, and refuses one of another template', async () => {
      const res = await request(app).post(`/api/callsheets/templates/${templateId}/items`).send({title: 'Nog even', durationSec: 60}).expect(201);
      // The last item made is the linked 'Camera op middenstip', in Eerste helft
      expect(res.body.chapterId).toBe(chapters['Eerste helft']);
      await request(app).delete(`/api/callsheets/templates/items/${res.body.id}`).expect(204);

      const other = await request(app).post('/api/callsheets/templates').send({name: `${MARKER} Ander`}).expect(201);
      templateIds.push(other.body.id);
      const foreign = await request(app).post(`/api/callsheets/templates/${other.body.id}/items`).send({title: 'X', durationSec: 1, chapterId: chapters['Rust']});
      expect(foreign.status).toBe(404);
    });

    it('writes the whole order at once: hoofdstukken and items, and refuses an incomplete one', async () => {
      const order = [
        {id: chapters['Rust'], itemIds: [items['Rust'], items['Kabels checken']]},
        {id: chapters['Voorbereiding'], itemIds: []},
        {id: chapters['Eerste helft'], itemIds: [items['Eerste helft'], items['Aftrap'], items['Camera op middenstip']]},
      ];
      await request(app).put(`/api/callsheets/templates/${templateId}/structure`).send({chapters: order}).expect(200);
      expect(byChapter(await template())).toEqual([
        ['Rust', ['Rust', 'Kabels checken']],
        ['Voorbereiding', []],
        ['Eerste helft', ['Eerste helft', 'Aftrap', 'Camera op middenstip']],
      ]);

      const missing = await request(app).put(`/api/callsheets/templates/${templateId}/structure`).send({chapters: order.slice(0, 2)});
      expect(missing.status).toBe(400);
      const splitLink = [order[0], order[1], {id: chapters['Eerste helft'], itemIds: [items['Eerste helft'], items['Aftrap']]}];
      splitLink[1] = {id: chapters['Voorbereiding'], itemIds: [items['Camera op middenstip']]};
      const res = await request(app).put(`/api/callsheets/templates/${templateId}/structure`).send({chapters: splitLink});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Een gekoppeld item hoort in het hoofdstuk van zijn hoofditem');

      // Back to the show order for the tests below
      await request(app).put(`/api/callsheets/templates/${templateId}/structure`).send({chapters: [
        {id: chapters['Voorbereiding'], itemIds: [items['Kabels checken']]},
        {id: chapters['Eerste helft'], itemIds: [items['Aftrap'], items['Eerste helft'], items['Camera op middenstip']]},
        {id: chapters['Rust'], itemIds: [items['Rust']]},
      ]}).expect(200);
    });

    it('deletes only an empty hoofdstuk', async () => {
      expect((await request(app).delete(`/api/callsheets/templates/chapters/${chapters['Rust']}`)).status).toBe(409);
      const empty = await request(app).post(`/api/callsheets/templates/${templateId}/chapters`).send({name: 'Leeg'}).expect(201);
      await request(app).delete(`/api/callsheets/templates/chapters/${empty.body.id}`).expect(204);
    });

    it('keeps the hoofdstukken through a JSON and an Excel export and import', async () => {
      const json = await request(app).get(`/api/callsheets/templates/${templateId}/export-json`).expect(200);
      expect(json.body.version).toBe(2);
      const fromJson = await request(app).post('/api/callsheets/templates/import-json').send({...json.body, name: `${MARKER} JSON`}).expect(201);
      templateIds.push(fromJson.body.id);
      const imported = await template(fromJson.body.id);
      expect(imported.items.find((i) => i.title === 'Aftrap')).toMatchObject({cue: 'AFTRAP'});
      expect(byChapter(imported)).toEqual(byChapter(await template()));
      expect(imported.chapters.find((c) => c.name === 'Eerste helft')?.positions.map((p) => p.positionId)).toEqual([positionId]);

      const excel = await request(app).get(`/api/callsheets/templates/${templateId}/export`).buffer()
        .parse((res, cb) => {
          const data: Buffer[] = [];
          res.on('data', (chunk: Buffer) => data.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(data)));
        }).expect(200);
      const fromExcel = await request(app).post('/api/callsheets/templates/import').field('name', `${MARKER} Excel`)
        .attach('file', excel.body as Buffer, {filename: 'draaiboek.xlsx'}).expect(201);
      templateIds.push(fromExcel.body.id);
      expect(byChapter(await template(fromExcel.body.id)).map(([name, titles]) => [name, [...titles].sort()]))
        .toEqual(byChapter(await template()).map(([name, titles]) => [name, [...titles].sort()]));
    });
  });

  describe('production', () => {
    const productionChapters = async () => prisma.productionChapter.findMany({where: {productionId: show.productionId}, orderBy: {volgorde: 'asc'}});

    it('takes the template\'s hoofdstukken when applied; one with the same name keeps its bezetting', async () => {
      const kept = await prisma.productionChapter.findFirstOrThrow({where: {productionId: show.productionId, naam: 'Eerste helft'}});
      const assignment = await prisma.chapterRoleAssignment.create({data: {productionSegmentId: kept.id, personId: show.personIds[`${MARKER} Persoon`], positionId}});

      await request(app).post(`/api/callsheets/templates/${templateId}/apply/${show.productionId}`).send({}).expect(200);
      const after = await productionChapters();
      expect(after.map((c) => c.naam)).toEqual(['Voorbereiding', 'Eerste helft', 'Rust']);
      expect(after[1].id).toBe(kept.id);
      expect(await prisma.chapterRoleAssignment.count({where: {id: assignment.id}})).toBe(1);

      const callSheet = await prisma.callSheet.findFirstOrThrow({where: {productionId: show.productionId}, include: {items: {orderBy: {orderIndex: 'asc'}}}});
      const chapterName = new Map(after.map((c) => [c.id, c.naam]));
      expect(callSheet.items.map((i) => [i.title, chapterName.get(i.productionSegmentId ?? -1)])).toEqual([
        ['Kabels checken', 'Voorbereiding'], ['Aftrap', 'Eerste helft'], ['Eerste helft', 'Eerste helft'], ['Camera op middenstip', 'Eerste helft'], ['Rust', 'Rust'],
      ]);
      // The cue comes along from the template (e.g. for a vMix trigger)
      expect(callSheet.items.find((i) => i.title === 'Aftrap')?.cue).toBe('AFTRAP');
      const events = await prisma.productionEvent.findMany({where: {productionId: show.productionId}});
      expect(events.every((e) => e.chapterId != null)).toBe(true);
      // The standard positions come from the template's hoofdstuk
      const positions = await request(app).get(`/api/production/segments/${kept.id}/positions`).expect(200);
      expect(positions.body.map((p: { id: number }) => p.id)).toEqual([positionId]);
    });

    it('edits the production\'s hoofdstukken and the order of a callsheet', async () => {
      const callSheet = await prisma.callSheet.findFirstOrThrow({where: {productionId: show.productionId}, include: {items: {orderBy: {orderIndex: 'asc'}}}});
      const extra = await request(app).post(`/api/production/${show.productionId}/chapters`).send({name: 'Nabeschouwing'}).expect(201);
      await request(app).put(`/api/production/chapters/${extra.body.id}`).send({name: 'Nabeschouwing en interviews'}).expect(200);

      // A new item without a hoofdstuk lands in the hoofdstuk of the last item; one of another production is refused
      const item = await request(app).post(`/api/production/callsheets/${callSheet.id}/items`).send({cue: 'N1', title: 'Interview', durationSec: 120, orderIndex: 99}).expect(201);
      expect(item.body.productionSegmentId).toBe(callSheet.items[callSheet.items.length - 1].productionSegmentId);
      const other = await createProductionScenario(prisma, {items: [], segments: [{naam: 'Ander', duurInMinuten: 5}]});
      try {
        const foreignChapter = (await prisma.productionChapter.findFirstOrThrow({where: {productionId: other.productionId}})).id;
        const res = await request(app).put(`/api/production/callsheet-items/${item.body.id}`).send({productionSegmentId: foreignChapter});
        expect(res.status).toBe(404);
      } finally {
        await other.cleanup();
      }

      const all = await productionChapters();
      const ids = (name: string) => all.find((c) => c.naam === name)?.id ?? -1;
      const allItems = [...callSheet.items.map((i) => i.id), item.body.id];
      await request(app).put(`/api/production/callsheets/${callSheet.id}/structure`).send({chapters: [
        {id: ids('Voorbereiding'), itemIds: allItems.slice(0, 1)},
        {id: ids('Eerste helft'), itemIds: allItems.slice(1, 4)},
        {id: ids('Rust'), itemIds: allItems.slice(4, 5)},
        {id: ids('Nabeschouwing en interviews'), itemIds: [item.body.id]},
      ]}).expect(200);
      const moved = await prisma.callSheetItem.findUniqueOrThrow({where: {id: item.body.id}});
      expect([moved.productionSegmentId, moved.orderIndex]).toEqual([ids('Nabeschouwing en interviews'), 6]);
      expect((await request(app).delete(`/api/production/chapters/${ids('Nabeschouwing en interviews')}`)).status).toBe(409);
    });

    it('saves a callsheet as a new template with its hoofdstukken, links and standard positions', async () => {
      const callSheet = await prisma.callSheet.findFirstOrThrow({where: {productionId: show.productionId}});
      const res = await request(app).post(`/api/callsheets/templates/from-callsheet/${callSheet.id}`).send({name: `${MARKER} Kopie`}).expect(201);
      templateIds.push(res.body.id);
      const copy = await template(res.body.id);
      expect(byChapter(copy)).toEqual([
        ['Voorbereiding', ['Kabels checken']],
        ['Eerste helft', ['Aftrap', 'Eerste helft', 'Camera op middenstip']],
        ['Rust', ['Rust']],
        ['Nabeschouwing en interviews', ['Interview']],
      ]);
      expect(copy.chapters[1].positions.map((p) => p.positionId)).toEqual([positionId]);
      const linked = await prisma.callSheetTemplateItem.findFirstOrThrow({where: {templateId: res.body.id, title: 'Camera op middenstip'}, include: {parent: true}});
      expect(linked.parent?.title).toBe('Aftrap');
      expect(linked.parent?.cue).toBe('AFTRAP');
    });
  });
});
