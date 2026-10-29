import request from 'supertest';
import {afterAll, describe, expect, it} from 'vitest';
import app from '../main';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

const MIN = 60_000;

/**
 * Files from before hoofdstukken (openspec/changes/chapters D7): a production export with segments
 * (duration, anchor) and items without a segment, and a backup of segment templates. Every item must
 * end up in a hoofdstuk.
 */
describe.runIf(runDb)('older files without hoofdstukken (integration)', () => {
  const KICKOFF = new Date(Date.now() + 7 * 24 * 60 * MIN); // a match next week: checked in Beheer
  const at = (minutes: number) => new Date(KICKOFF.getTime() + minutes * MIN).toISOString();
  const externalId = `chapters-legacy-${Date.now()}`;
  const templateName = `Legacy ${Date.now()}`;
  let productionId: number;

  afterAll(async () => {
    await prisma.production.deleteMany({where: {matchSchedule: {externalId}}});
    await prisma.matchSchedule.deleteMany({where: {externalId}});
    await prisma.callSheetTemplate.deleteMany({where: {name: `${templateName} (hoofdstukken)`}});
  });

  // Back to back from 25 minutes before the kickoff, no anchor: the stored times count
  const titles: Array<[string, number]> = [
    ['Kabels checken', 5], ['Voorbeschouwing', 20], ['Eerste helft', 35], ['Rust', 10], ['Na de rust', 10],
  ];
  let start = -25;
  const items = titles.map(([title, minutes], i) => {
    const item = {id: `old-${i}`, cue: `C${i}`, title, durationSec: minutes * 60, orderIndex: i + 1, timeStart: at(start), timeEnd: at(start + minutes), positions: []};
    start += minutes;
    return item;
  });

  it('places the items of an old production export by the segments\' times, with Voorbereiding in front', async () => {
    const res = await request(app).post('/api/production/import').send({
      matchSchedule: {externalId, date: KICKOFF.toISOString(), homeTeamName: 'Oud Thuis', awayTeamName: 'Oud Uit'},
      production: {isActive: false},
      persons: [], positions: [], interviews: [], titles: [],
      segments: [
        {naam: 'Voorbeschouwing', volgorde: 1, duurInMinuten: 20, isTimeAnchor: false, assignments: []},
        {naam: 'Eerste helft', volgorde: 2, duurInMinuten: 35, isTimeAnchor: true, assignments: []},
        {naam: 'Rust', volgorde: 3, duurInMinuten: 10, isTimeAnchor: false, assignments: []},
      ],
      callSheets: [{name: 'Oud draaiboek', items}],
      productionEvents: [
        ...items.map((it, i) => ({id: `ev-${i}`, title: it.title, status: 'WAITING', order: i + 1, plannedStartTime: it.timeStart, callSheetItemId: it.id, positions: []})),
        {id: 'ev-manual', title: 'Handmatig', status: 'WAITING', order: 9, plannedStartTime: at(40), positions: []},
      ],
    });
    expect(res.status, res.text).toBe(200);
    productionId = res.body.id;

    const chapters = await prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}});
    expect(chapters.map((c) => c.name)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
    const chapterName = new Map(chapters.map((c) => [c.id, c.name]));
    const stored = await prisma.callSheetItem.findMany({where: {callSheet: {productionId}}, orderBy: {orderIndex: 'asc'}});
    expect(stored.map((i) => chapterName.get(i.chapterId ?? -1))).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust', 'Rust']);
    const events = await prisma.productionEvent.findMany({where: {productionId}, orderBy: {order: 'asc'}});
    expect(events.map((e) => chapterName.get(e.chapterId ?? -1))).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust', 'Rust', 'Rust']);
    expect((await prisma.production.findUniqueOrThrow({where: {id: productionId}})).chaptersAutoPlaced).toBe(true);
  });

  it('derives the timing from the items and sends the hoofdstukken to LIVE', async () => {
    const timing = await request(app).get(`/api/production/${productionId}/timing`);
    expect(timing.status).toBe(200);
    expect(timing.body.map((c: { name: string; start: string; end: string; durationMinutes: number }) => [c.name, c.start, c.end, c.durationMinutes])).toEqual([
      ['Voorbereiding', at(-25), at(-20), 5],
      ['Voorbeschouwing', at(-20), at(0), 20],
      ['Eerste helft', at(0), at(35), 35],
      ['Rust', at(35), at(55), 20],
    ]);
    const chapters = await request(app).get(`/api/production/${productionId}/chapters`);
    expect(chapters.body.map((c: { name: string; orderIndex: number }) => [c.name, c.orderIndex])).toEqual([
      ['Voorbereiding', 1], ['Voorbeschouwing', 2], ['Eerste helft', 3], ['Rust', 4],
    ]);
    expect(chapters.body[0]).not.toHaveProperty('naam');

    const events = await request(app).get(`/api/production/${productionId}/events`);
    expect(events.body.chapters.map((c: { name: string }) => c.name)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
  });

  it('exports the hoofdstukken in the new format, and imports that again unchanged', async () => {
    const exported = await request(app).get(`/api/production/${productionId}/export`);
    expect(exported.status).toBe(200);
    expect(exported.body.segments).toBeUndefined();
    expect(exported.body.chapters.map((c: { name: string }) => c.name)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
    expect(exported.body.callSheets[0].items.map((i: { chapterOrderIndex: number }) => i.chapterOrderIndex)).toEqual([1, 2, 3, 4, 4]);

    expect((await request(app).post('/api/production/import').send(exported.body)).status).toBe(200);
    const chapters = await prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}, include: {callSheetItems: true}});
    expect(chapters.map((c) => [c.name, c.callSheetItems.length])).toEqual([['Voorbereiding', 1], ['Voorbeschouwing', 1], ['Eerste helft', 1], ['Rust', 2]]);
  });

  it('turns segment templates of an old backup into draaiboek templates with only hoofdstukken', async () => {
    const res = await request(app).post('/api/backup/segment-templates/import').send([
      {version: 1, name: templateName, items: [{naam: 'Rust', volgorde: 2, duurInMinuten: 10}, {naam: 'Eerste helft', volgorde: 1, duurInMinuten: 35}]},
    ]);
    expect(res.status).toBe(200);
    const template = await prisma.callSheetTemplate.findFirstOrThrow({
      where: {name: `${templateName} (hoofdstukken)`}, include: {chapters: {orderBy: {orderIndex: 'asc'}}, items: true},
    });
    expect(template.chapters.map((c) => c.name)).toEqual(['Eerste helft', 'Rust']);
    expect(template.items).toEqual([]);
  });
});
