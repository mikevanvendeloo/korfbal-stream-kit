import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ensureOrganization, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma} from '../../test-helpers';
import {runWithOrganization} from './organizationContext';
import {clearSettingsCache} from './appSettings';
import {migrateOrganizationChapters} from './chapterMigration';

const runDb = process.env.REQUIRE_DB === 'true';

const MIN = 60_000;
const SLUG = 'chapters-migration';

/**
 * The migration of segments into hoofdstukken (openspec/changes/chapters D7), in an organization of its
 * own: it touches every production and template of the organization, and sets a setting once.
 */
describe.runIf(runDb)('startup migration: segments become hoofdstukken (integration)', () => {
  let organizationId: number;
  let show: ProductionScenario;
  let templateId: number;
  let positionId: number;
  const KICKOFF = new Date(Date.now() + 7 * 24 * 60 * MIN); // a match next week: checked in Beheer
  const inOrg = <T>(fn: () => Promise<T>) => runWithOrganization(organizationId, fn);

  beforeAll(async () => {
    organizationId = await ensureOrganization(prisma, SLUG, 'Hoofdstukken migratie');
    // A production: segments around the kickoff, a callsheet without anchor (its stored times count)
    show = await createProductionScenario(prisma, {
      organizationId,
      match: {date: KICKOFF, homeTeamName: 'Hoofdstuk Thuis', awayTeamName: 'Hoofdstuk Uit'},
      chapters: ['Voorbeschouwing', 'Eerste helft', 'Rust'],
      startsAt: new Date(KICKOFF.getTime() - 25 * MIN),
      items: [
        {title: 'Kabels checken', durationSec: 300},   // −25: before Voorbeschouwing → Voorbereiding
        {title: 'Voorbeschouwing', durationSec: 1200}, // −20
        {title: 'Eerste helft', durationSec: 2100},    // 0
        {title: 'Rust', durationSec: 600},             // +35
        {title: 'Na de rust', durationSec: 600},       // +45, after the last window → Rust
      ],
      callSheet: true,
    });

    // As the production was before hoofdstukken: segments with a duration and an anchor, items and events without a segment
    await inOrg(async () => {
      const durations: Record<string, [number, boolean]> = {'Voorbeschouwing': [20, false], 'Eerste helft': [35, true], 'Rust': [10, false]};
      for (const [name, id] of Object.entries(show.chapterIds)) {
        await prisma.productionChapter.update({where: {id}, data: {duurInMinuten: durations[name][0], isTimeAnchor: durations[name][1]}});
      }
      await prisma.callSheetItem.updateMany({where: {id: {in: show.callSheetItemIds}}, data: {chapterId: null}});
      await prisma.productionEvent.updateMany({where: {id: {in: show.eventIds}}, data: {chapterId: null}});
    });

    // Templates: the default segment template with a standard position, another one, and a draaiboek
    await inOrg(async () => {
      positionId = (await prisma.position.create({data: {name: 'Hoofdstuk Camera', category: 'TECHNICAL'}})).id;
      await prisma.segmentTemplate.create({data: {name: 'League', isDefault: true, items: {create: [
        {naam: 'Voorbeschouwing', volgorde: 1, duurInMinuten: 20},
        {naam: 'Eerste helft', volgorde: 2, duurInMinuten: 35, isTimeAnchor: true},
        {naam: 'Rust', volgorde: 3, duurInMinuten: 10},
      ]}}});
      await prisma.segmentTemplate.create({data: {name: 'Oploop', items: {create: [{naam: 'Oplopen', volgorde: 1, duurInMinuten: 10}]}}});
      await prisma.segmentDefaultPosition.create({data: {segmentName: 'Eerste helft', positionId, order: 1}});
      const template = await prisma.callSheetTemplate.create({data: {name: 'Draaiboek League'}});
      templateId = template.id;
      const items: Array<[string, number, string | null]> = [
        ['Kabels checken', 1200, null], ['Livestream starten', 0, 'LIVESTREAM_START'], ['Welkom', 600, null],
        ['Start wedstrijd', 0, 'MATCH_START'], ['Eerste helft', 2100, null], ['Rust', 600, null],
      ];
      for (const [orderIndex, [title, durationSec, anchorType]] of items.entries()) {
        await prisma.callSheetTemplateItem.create({data: {templateId, title, durationSec, orderIndex, isTimeAnchor: !!anchorType, anchorType}});
      }
    });

    await inOrg(() => migrateOrganizationChapters());
  });

  afterAll(async () => {
    await show?.cleanup();
    await prisma.organization.deleteMany({where: {slug: SLUG}});
    clearSettingsCache();
  });

  const chapterNames = (productionId: number) => inOrg(async () =>
    (await prisma.productionChapter.findMany({where: {productionId}, orderBy: {orderIndex: 'asc'}})).map((c) => c.name));

  it('puts the production\'s items and events in the segment holding their start, with Voorbereiding in front', async () => {
    expect(await chapterNames(show.productionId)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
    const items = await inOrg(() => prisma.callSheetItem.findMany({where: {id: {in: show.callSheetItemIds}}, orderBy: {orderIndex: 'asc'}, include: {chapter: true}}));
    expect(items.map((i) => i.chapter?.name)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust', 'Rust']);
    const events = await inOrg(() => prisma.productionEvent.findMany({where: {id: {in: show.eventIds}}, orderBy: {order: 'asc'}, include: {chapter: true}}));
    expect(events.map((e) => e.chapter?.name)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust', 'Rust']);
    // A match from now on is flagged for checking in Beheer
    expect((await inOrg(() => prisma.production.findUniqueOrThrow({where: {id: show.productionId}}))).chaptersAutoPlaced).toBe(true);
  });

  it('gives a draaiboek template the hoofdstukken of the default segment template, placed from the match start anchor', async () => {
    const chapters = await inOrg(() => prisma.callSheetTemplateChapter.findMany({
      where: {templateId}, orderBy: {orderIndex: 'asc'}, include: {items: {orderBy: {orderIndex: 'asc'}}, positions: true},
    }));
    expect(chapters.map((c) => [c.name, c.items.map((i) => i.title)])).toEqual([
      ['Voorbereiding', ['Kabels checken']],
      ['Voorbeschouwing', ['Livestream starten', 'Welkom']],
      ['Eerste helft', ['Start wedstrijd', 'Eerste helft']],
      ['Rust', ['Rust']],
    ]);
    // The standard positions moved from the segment name to the hoofdstuk
    expect(chapters.find((c) => c.name === 'Eerste helft')?.positions.map((p) => p.positionId)).toEqual([positionId]);
    expect((await inOrg(() => prisma.callSheetTemplate.findUniqueOrThrow({where: {id: templateId}}))).chaptersAutoPlaced).toBe(true);
  });

  it('keeps another segment template as a draaiboek template with only hoofdstukken', async () => {
    const kept = await inOrg(() => prisma.callSheetTemplate.findFirst({where: {name: 'Oploop (hoofdstukken)'}, include: {chapters: true, items: true}}));
    expect(kept?.chapters.map((c) => c.name)).toEqual(['Oplopen']);
    expect(kept?.items).toEqual([]);
  });

  it('does nothing the second time, also not when the kept template was deleted', async () => {
    await inOrg(() => prisma.callSheetTemplate.deleteMany({where: {name: 'Oploop (hoofdstukken)'}}));
    expect(await inOrg(() => migrateOrganizationChapters())).toEqual({productions: 0, templates: 0, keptSegmentTemplates: 0});
    expect(await chapterNames(show.productionId)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
    expect(await inOrg(() => prisma.callSheetTemplate.count({where: {name: 'Oploop (hoofdstukken)'}}))).toBe(0);
  });

  it('derives the timing from the items and sends the hoofdstukken to LIVE', async () => {
    const at = (minutes: number) => new Date(KICKOFF.getTime() + minutes * MIN).toISOString();
    const timing = await request(app).get(`/api/production/${show.productionId}/timing`).set('X-Organization', SLUG);
    expect(timing.status).toBe(200);
    expect(timing.body.map((c: { name: string; start: string; end: string; durationMinutes: number }) => [c.name, c.start, c.end, c.durationMinutes])).toEqual([
      ['Voorbereiding', at(-25), at(-20), 5],
      ['Voorbeschouwing', at(-20), at(0), 20],
      ['Eerste helft', at(0), at(35), 35],
      ['Rust', at(35), at(55), 20],
    ]);

    const events = await request(app).get(`/api/production/${show.productionId}/events`).set('X-Organization', SLUG);
    expect(events.body.chapters.map((c: { name: string }) => c.name)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
    expect(new Set(events.body.items.map((e: { chapterId: number | null }) => e.chapterId)).has(null)).toBe(false);
  });

  it('after a restart leaves a migrated production alone: a new event is in a hoofdstuk, a stray one goes to the last', async () => {
    await inOrg(() => prisma.production.update({where: {id: show.productionId}, data: {chaptersAutoPlaced: false}}));
    const posted = await request(app).post(`/api/production/${show.productionId}/events`).set('X-Organization', SLUG)
      .send({title: 'Handmatig na de start', order: 99, positionIds: []});
    expect(posted.status, posted.text).toBe(201);
    expect(posted.body.chapterId).not.toBeNull();
    // An event an older version wrote without a hoofdstuk, long before the kickoff
    const stray = await inOrg(() => prisma.productionEvent.create({
      data: {productionId: show.productionId, title: 'Zwerver', order: 100, plannedStartTime: new Date(KICKOFF.getTime() - 120 * MIN)},
    }));

    expect(await inOrg(() => migrateOrganizationChapters())).toEqual({productions: 1, templates: 0, keptSegmentTemplates: 0});
    expect(await chapterNames(show.productionId)).toEqual(['Voorbereiding', 'Voorbeschouwing', 'Eerste helft', 'Rust']);
    const production = await inOrg(() => prisma.production.findUniqueOrThrow({where: {id: show.productionId}, include: {chapters: {orderBy: {orderIndex: 'desc'}, take: 1}}}));
    expect(production.chaptersAutoPlaced).toBe(false);
    expect((await inOrg(() => prisma.productionEvent.findUniqueOrThrow({where: {id: stray.id}}))).chapterId).toBe(production.chapters[0].id);
  });
});
