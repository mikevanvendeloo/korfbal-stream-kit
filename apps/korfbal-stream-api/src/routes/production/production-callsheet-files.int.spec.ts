import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../../main';
import {testDb as prisma} from '../../../test-helpers';
import {createProductionScenario, type ProductionScenario} from '../../../test-scenarios';

const runDb = process.env.REQUIRE_DB === 'true';
const MIN = 60_000;

/** Supertest parser that keeps a binary body (an .xlsx) as a Buffer. */
function binary(res: NodeJS.ReadableStream, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

describe.runIf(runDb)('productiedraaiboek export and import (integration)', () => {
  const KICKOFF_A = new Date('2026-11-14T19:30:00.000Z');
  const KICKOFF_B = new Date('2026-11-21T14:30:00.000Z');
  const POSITIONS = ['Draaiboekbestand Regie', 'Draaiboekbestand Camera'];
  let source: ProductionScenario;
  let target: ProductionScenario;
  let sourceCallSheetId: number;
  let targetCallSheetId: number;
  const templateIds: number[] = [];

  beforeAll(async () => {
    source = await createProductionScenario(prisma, {
      match: {date: KICKOFF_A, homeTeamName: 'Bestand Thuis', awayTeamName: 'Bestand Uit'},
      chapters: ['Voorbeschouwing', 'Eerste helft', 'Nabeschouwing'],
      startsAt: new Date(KICKOFF_A.getTime() - 10 * MIN),
      items: [
        {title: 'Opening', durationSec: 600, chapter: 'Voorbeschouwing'},
        {title: 'Aftrap', durationSec: 0, chapter: 'Eerste helft'},
        {title: 'Eerste helft', durationSec: 2100},
        {title: 'Camera mee', durationSec: 30},
        {title: 'Interview', durationSec: 180, chapter: 'Nabeschouwing'},
      ],
      callSheet: true,
    });
    const [opening, aftrap, , cameraMee] = source.callSheetItemIds;
    const positionIds = [];
    for (const name of POSITIONS) positionIds.push((await prisma.position.create({data: {name}})).id);
    await prisma.callSheetItem.update({where: {id: aftrap}, data: {isTimeAnchor: true, anchorType: 'MATCH_START', cue: 'AFTRAP'}});
    await prisma.callSheetItem.update({where: {id: cameraMee}, data: {parentId: aftrap}});
    await prisma.callSheetItemPosition.createMany({data: [
      {callSheetItemId: opening, positionId: positionIds[0]},
      {callSheetItemId: aftrap, positionId: positionIds[0]},
      {callSheetItemId: aftrap, positionId: positionIds[1]},
    ]});
    sourceCallSheetId = (await prisma.callSheet.findFirstOrThrow({where: {productionId: source.productionId}})).id;

    // Another production, with hoofdstukken spelled differently and one the file doesn't have
    target = await createProductionScenario(prisma, {
      match: {date: KICKOFF_B, homeTeamName: 'Doel Thuis', awayTeamName: 'Doel Uit'},
      chapters: ['voorbeschouwing', 'Eerste  Helft', 'Rust'],
      items: [{title: 'Oud item'}],
      callSheet: true,
    });
    targetCallSheetId = (await prisma.callSheet.findFirstOrThrow({where: {productionId: target.productionId}})).id;
  });

  afterAll(async () => {
    await prisma.callSheetTemplate.deleteMany({where: {id: {in: templateIds}}});
    await source?.cleanup();
    await target?.cleanup();
    await prisma.position.deleteMany({where: {name: {in: POSITIONS}}});
  });

  const exportJson = async (callSheetId: number) => {
    const res = await request(app).get(`/api/production/callsheets/${callSheetId}/export-json`);
    expect(res.status, res.text).toBe(200);
    return res;
  };

  const draaiboek = async (callSheetId: number) => {
    const callSheet = await prisma.callSheet.findUniqueOrThrow({
      where: {id: callSheetId},
      include: {items: {orderBy: {orderIndex: 'asc'}, include: {chapter: true, parent: true, positions: {include: {position: true}}}}},
    });
    return callSheet.items.map((i) => ({
      title: i.title, cue: i.cue, chapter: i.chapter?.name.toLowerCase().replace(/\s+/g, ' '), parent: i.parent?.title ?? null,
      positions: i.positions.map((p) => p.position.name).sort(), durationSec: i.durationSec, anchor: i.isTimeAnchor ? i.anchorType : null,
    }));
  };

  it('exports a production draaiboek in the template format, with times relative to the kickoff', async () => {
    const res = await exportJson(sourceCallSheetId);
    expect(res.headers['content-disposition']).toBe('attachment; filename="draaiboek-2026-11-14-Bestand-Thuis-Bestand-Uit.json"');
    expect(res.body).toMatchObject({version: 2, kind: 'productie-draaiboek'});
    expect(res.body.chapters.map((c: { name: string }) => c.name)).toEqual(['Voorbeschouwing', 'Eerste helft', 'Nabeschouwing']);
    const aftrap = res.body.items.find((i: { title: string }) => i.title === 'Aftrap');
    expect(aftrap).toMatchObject({chapter: 'Eerste helft', cue: 'AFTRAP', isTimeAnchor: true, anchorType: 'MATCH_START', startOffsetSec: 0});
    expect([...aftrap.positions].sort()).toEqual([...POSITIONS].sort());
    expect(res.body.items.find((i: { title: string }) => i.title === 'Camera mee').parentId).toBe(aftrap.id);
  });

  it('imports it into another production: same hoofdstukken, items, positions and links; times from its own kickoff', async () => {
    const file = (await exportJson(sourceCallSheetId)).body;
    const res = await request(app).post(`/api/production/callsheets/${targetCallSheetId}/import-json`)
      .attach('file', Buffer.from(JSON.stringify(file)), {filename: 'draaiboek.json'});
    expect(res.status, res.text).toBe(200);
    expect(res.body).toEqual({ok: true, items: 5, newChapters: ['Nabeschouwing']});

    expect(await draaiboek(targetCallSheetId)).toEqual(await draaiboek(sourceCallSheetId));
    // The production's own hoofdstukken stay (also Rust, now empty); the missing one is added at the end
    const chapters = await prisma.productionChapter.findMany({where: {productionId: target.productionId}, orderBy: {orderIndex: 'asc'}});
    expect(chapters.map((c) => c.name)).toEqual(['voorbeschouwing', 'Eerste  Helft', 'Rust', 'Nabeschouwing']);
    const items = await prisma.callSheetItem.findMany({where: {callSheetId: targetCallSheetId}});
    expect(items.some((i) => source.callSheetItemIds.includes(i.id))).toBe(false);
    expect(items.find((i) => i.title === 'Aftrap')?.timeStart?.toISOString()).toBe(KICKOFF_B.toISOString());
    expect(items.find((i) => i.title === 'Opening')?.timeStart?.toISOString()).toBe(new Date(KICKOFF_B.getTime() - 10 * MIN).toISOString());
  });

  it('imports a production draaiboek as a template, and a template into a production', async () => {
    const file = (await exportJson(sourceCallSheetId)).body;
    const asTemplate = await request(app).post('/api/callsheets/templates/import-json').send({...file, name: `Bestand sjabloon ${Date.now()}`});
    expect(asTemplate.status, asTemplate.text).toBe(201);
    templateIds.push(asTemplate.body.id);

    const templateFile = await request(app).get(`/api/callsheets/templates/${asTemplate.body.id}/export-json`);
    expect(templateFile.status).toBe(200);
    const res = await request(app).post(`/api/production/callsheets/${targetCallSheetId}/import-json`).send(templateFile.body);
    expect(res.status, res.text).toBe(200);
    // The template import adds the show caller to every item; the rest comes back as it was
    const titles = (await draaiboek(targetCallSheetId)).map(({title, chapter, parent}) => ({title, chapter, parent}));
    expect(titles).toEqual((await draaiboek(sourceCallSheetId)).map(({title, chapter, parent}) => ({title, chapter, parent})));
  });

  it('exports Excel in the columns the Excel import reads', async () => {
    const excel = await request(app).get(`/api/production/callsheets/${sourceCallSheetId}/export-excel`).buffer().parse(binary);
    expect(excel.status).toBe(200);
    expect(excel.headers['content-disposition']).toContain('draaiboek-2026-11-14-Bestand-Thuis-Bestand-Uit.xlsx');
    const res = await request(app).post(`/api/production/${target.productionId}/callsheets/import-excel`)
      .attach('file', excel.body as Buffer, {filename: 'draaiboek.xlsx'}).field('name', 'Uit Excel');
    expect(res.status, res.text).toBe(201);
    // Items without a cue are skipped by the Excel import; the others come back in their hoofdstuk
    const imported = await draaiboek(res.body.callSheet.id);
    const withCue = (await draaiboek(sourceCallSheetId)).filter((i) => i.cue);
    expect(imported.map(({title, chapter}) => ({title, chapter}))).toEqual(withCue.map(({title, chapter}) => ({title, chapter})));
  });
});
