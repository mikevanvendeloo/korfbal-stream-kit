import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {getCurrentState, stopProduction} from '../services/productionState';
import {createProductionScenario, ProductionScenario, ScenarioItem} from '../../test-scenarios';
import {inTestOrganization, testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
const KICKOFF = new Date('2026-11-14T19:30:00Z');
const MIN = 60;
const minutesAfterKickoff = (d: Date | null) => (d ? (d.getTime() - KICKOFF.getTime()) / 60000 : null);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The rust: 2+2 minutes in the hall, 4+4 on the stream, at least 10 minutes (openspec/changes/parallel-lanes) */
const RUST: ScenarioItem[] = [
  {title: 'Aftrap', durationSec: 35 * MIN, isTimeAnchor: true, isInVenue: true, chapter: 'Eerste helft'},
  {title: 'Reclame LED 1', durationSec: 2 * MIN, isInVenue: true, isInLivestream: false, chapter: 'Rust'},
  {title: 'Analyse 1', durationSec: 4 * MIN},
  {title: 'Reclame LED 2', durationSec: 2 * MIN, isInVenue: true, isInLivestream: false},
  {title: 'Analyse 2', durationSec: 4 * MIN},
  {title: 'Tweede helft', durationSec: 35 * MIN, isInVenue: true, chapter: 'Tweede helft'},
];
const CHAPTERS = ['Eerste helft', 'Rust', 'Tweede helft'];

describe.runIf(runDb)('parallel lanes: times (integration)', () => {
  let show: ProductionScenario;
  let templateId: number | undefined;

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      items: RUST, chapters: CHAPTERS, chapterMinimums: {Rust: 10 * MIN}, callSheet: true, match: {date: KICKOFF},
    });
  });

  afterAll(async () => {
    if (templateId) await prisma.callSheetTemplate.delete({where: {id: templateId}});
    await show.cleanup();
  });

  it('Tijden herberekenen: the lanes start together, the next hoofdstuk after the minimum', async () => {
    const callSheet = await prisma.callSheet.findFirstOrThrow({where: {productionId: show.productionId}});
    expect((await request(app).post(`/api/production/callsheets/${callSheet.id}/calculate-times`)).status).toBe(200);
    const items = await prisma.callSheetItem.findMany({where: {callSheetId: callSheet.id}, orderBy: {orderIndex: 'asc'}});
    expect(items.map((i) => minutesAfterKickoff(i.timeStart))).toEqual([0, 35, 35, 37, 39, 45]);

    const timing = await request(app).get(`/api/production/${show.productionId}/timing`);
    expect(timing.status).toBe(200);
    const rust = timing.body.find((c: { name: string }) => c.name === 'Rust');
    expect(rust).toMatchObject({minDurationSec: 600, overrunSec: 0, durationMinutes: 10});
    expect(minutesAfterKickoff(new Date(rust.end))).toBe(45);
  });

  it('a hoofdstuk PUT sets and clears the minimum', async () => {
    const chapterId = show.chapterIds['Rust'];
    const put = await request(app).put(`/api/production/chapters/${chapterId}`).send({minDurationSec: 720});
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({name: 'Rust', minDurationSec: 720});
    expect((await request(app).put(`/api/production/chapters/${chapterId}`).send({minDurationSec: null})).body.minDurationSec).toBeNull();
    expect((await request(app).put(`/api/production/chapters/${chapterId}`).send({minDurationSec: -1})).status).toBe(400);
    await request(app).put(`/api/production/chapters/${chapterId}`).send({minDurationSec: 600});
  });

  it('a template: GET gives the times from the API, applying it copies the minimum and lays out the lanes', async () => {
    const template = await prisma.callSheetTemplate.create({data: {name: `Lanes ${Date.now()}`}});
    templateId = template.id;
    const chapterIds: Record<string, string> = {};
    for (const [orderIndex, name] of CHAPTERS.entries()) {
      chapterIds[name] = (await prisma.callSheetTemplateChapter.create({
        data: {templateId: template.id, name, orderIndex, minDurationSec: name === 'Rust' ? 600 : null},
      })).id;
    }
    let chapter = CHAPTERS[0];
    for (const [orderIndex, item] of RUST.entries()) {
      chapter = item.chapter ?? chapter;
      await prisma.callSheetTemplateItem.create({
        data: {
          templateId: template.id, chapterId: chapterIds[chapter], title: item.title, durationSec: item.durationSec ?? 0, orderIndex,
          isInVenue: item.isInVenue ?? false, isInLivestream: item.isInLivestream ?? true,
          isTimeAnchor: item.isTimeAnchor ?? false, anchorType: item.isTimeAnchor ? 'MATCH_START' : null,
        },
      });
    }

    const got = await request(app).get(`/api/callsheets/templates/${template.id}`);
    expect(got.status).toBe(200);
    const offsets = Object.fromEntries(got.body.items.map((i: { title: string; startOffsetSec: number }) => [i.title, i.startOffsetSec / 60]));
    expect(offsets).toEqual({'Aftrap': 0, 'Reclame LED 1': 35, 'Analyse 1': 35, 'Reclame LED 2': 37, 'Analyse 2': 39, 'Tweede helft': 45});
    const rust = got.body.chapters.find((c: { name: string }) => c.name === 'Rust');
    expect(rust).toMatchObject({minDurationSec: 600, startOffsetSec: 35 * MIN, endOffsetSec: 45 * MIN, overrunSec: 0});

    expect((await request(app).post(`/api/callsheets/templates/${template.id}/apply/${show.productionId}`)).status).toBe(200);
    const chapters = await prisma.productionChapter.findMany({where: {productionId: show.productionId}, orderBy: {orderIndex: 'asc'}});
    expect(chapters.map((c) => c.minDurationSec)).toEqual([null, 600, null]);
    const items = await prisma.callSheetItem.findMany({where: {callSheet: {productionId: show.productionId}}, orderBy: {orderIndex: 'asc'}});
    expect(items.map((i) => minutesAfterKickoff(i.timeStart))).toEqual([0, 35, 35, 37, 39, 45]);
  });
});

describe.runIf(runDb)('parallel lanes: LIVE (integration)', () => {
  let show: ProductionScenario;
  let ids: string[];

  const snapshot = () => inTestOrganization(async () => {
    const {activeEventId, activeVenueEventId} = getCurrentState();
    return {activeEventId, activeVenueEventId};
  });
  const event = (id: string) => prisma.productionEvent.findUniqueOrThrow({where: {id}});

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {
      active: true,
      items: [
        {title: 'Rust begint', durationSec: 60, isInVenue: true},
        {title: 'Analyse 1', durationSec: 300},
        {title: 'Reclame LED 1', durationSec: 1, isInVenue: true, isInLivestream: false},
        {title: 'Reclame LED 2', durationSec: 600, isInVenue: true, isInLivestream: false},
        {title: 'Analyse 2', durationSec: 300},
        {title: 'Tweede helft', durationSec: 60, isInVenue: true},
      ],
    });
    ids = show.eventIds;
  });

  afterAll(async () => {
    await inTestOrganization(() => stopProduction(show.productionId));
    await show.cleanup();
  });

  it('the hall lane runs by itself, Volgend follows the stream and a samenkomstpunt ends the hall item', async () => {
    expect((await request(app).post(`/api/show/start/${show.productionId}`)).status).toBe(200);
    await wait(300);
    expect(await snapshot()).toEqual({activeEventId: ids[0], activeVenueEventId: null});

    // Zaal › without a hall item in the block: nothing happens
    const idle = await request(app).post(`/api/production/${show.productionId}/venue-next`);
    expect(idle.status).toBe(200);
    expect(idle.body).toMatchObject({activeEventId: ids[0], activeVenueEventId: null});

    // The first stream item of the block starts the hall lane
    expect((await request(app).post('/api/show/next')).status).toBe(200);
    expect(await snapshot()).toEqual({activeEventId: ids[1], activeVenueEventId: ids[2]});

    // The first hall item is over after its duration: the next one starts by itself
    await wait(1500);
    expect(await snapshot()).toEqual({activeEventId: ids[1], activeVenueEventId: ids[3]});
    const first = await event(ids[2]);
    expect(first.status).toBe('COMPLETED');
    expect(first.metadata).toMatchObject({actualEndTime: expect.any(String)});

    // Volgend skips the hall items and leaves the hall item running
    expect((await request(app).post('/api/show/next')).body.id).toBe(ids[4]);
    expect(await snapshot()).toEqual({activeEventId: ids[4], activeVenueEventId: ids[3]});
    expect((await event(ids[3])).status).toBe('ACTIVE');

    // At the samenkomstpunt the hall item ends
    expect((await request(app).post('/api/show/next')).body.id).toBe(ids[5]);
    expect(await snapshot()).toEqual({activeEventId: ids[5], activeVenueEventId: null});
    expect((await event(ids[3])).status).toBe('COMPLETED');

    // Vorig steps through the stream only
    expect((await request(app).post('/api/show/previous')).body.id).toBe(ids[4]);
  });

  it('Zaal › moves the hall lane on by hand', async () => {
    await prisma.productionEvent.updateMany({where: {id: {in: ids.slice(2, 4)}}, data: {status: 'WAITING'}});
    expect((await request(app).post('/api/show/previous')).body.id).toBe(ids[1]);
    expect(await snapshot()).toEqual({activeEventId: ids[1], activeVenueEventId: ids[2]});
    const next = await request(app).post(`/api/production/${show.productionId}/venue-next`);
    expect(next.status).toBe(200);
    expect(next.body).toMatchObject({activeEventId: ids[1], activeVenueEventId: ids[3], activeVenueStartTime: expect.any(String)});
    expect((await request(app).post(`/api/production/${show.productionId}/venue-next`)).body.activeVenueEventId).toBeNull();
  });

  it('venue-next: 409 for a production that is not live, 400 for a bad id', async () => {
    const other = await createProductionScenario(prisma, {items: [{title: 'Niet live'}]});
    try {
      expect((await request(app).post(`/api/production/${other.productionId}/venue-next`)).status).toBe(409);
      expect((await request(app).post('/api/production/abc/venue-next')).status).toBe(400);
    } finally {
      await other.cleanup();
    }
  });
});
