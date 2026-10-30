import {describe, expect, it} from 'vitest';
import {draaiboekFromProductionExport, layOutTimes, planDraaiboekImport} from './draaiboekFile';
import type {DraaiboekFile} from '../schemas/draaiboekFile';

const item = (title: string, extra: Partial<DraaiboekFile['items'][number]> = {}) => ({cue: '', title, durationSec: 60, ...extra});

describe('planDraaiboekImport', () => {
  it('matches hoofdstukken ignoring case and spacing, adds missing ones and orders by the production\'s hoofdstukken', () => {
    const plan = planDraaiboekImport({items: [
      item('Na', {chapter: 'Nabeschouwing'}),
      item('Aftrap', {chapter: 'eerste  HELFT'}),
      item('Opening', {chapter: 'Voorbeschouwing'}),
    ]}, ['Voorbeschouwing', 'Eerste helft']);
    expect(plan.newChapters).toEqual(['Nabeschouwing']);
    expect(plan.items.map((i) => [i.index, i.chapterName, i.orderIndex])).toEqual([[2, 'Voorbeschouwing', 1], [1, 'Eerste helft', 2], [0, 'Nabeschouwing', 3]]);
  });

  it('keeps a linked item with its parent and gives an item without hoofdstuk the one before it', () => {
    const plan = planDraaiboekImport({items: [
      item('Aftrap', {id: 'a', chapter: 'Eerste helft'}),
      item('Camera', {id: 'b', parentId: 'a', chapter: 'Rust'}),
      item('Los'),
    ]}, []);
    expect(plan.newChapters).toEqual(['Eerste helft']);
    expect(plan.items.map((i) => [i.chapterName, i.parentIndex])).toEqual([['Eerste helft', null], ['Eerste helft', 0], ['Eerste helft', null]]);
  });

  it('puts a file without hoofdstukken in the production\'s first one, or a new Draaiboek', () => {
    expect(planDraaiboekImport({items: [item('A')]}, ['Voorbereiding']).items[0].chapterName).toBe('Voorbereiding');
    expect(planDraaiboekImport({items: [item('A')]}, []).newChapters).toEqual(['Draaiboek']);
  });
});

describe('layOutTimes', () => {
  const kickoff = new Date('2026-11-14T19:30:00Z');
  const liveStart = new Date('2026-11-14T19:00:00Z');
  const row = (durationSec: number, anchorType: string | null = null, startOffsetSec: number | null = null) =>
    ({durationSec, isTimeAnchor: anchorType != null, anchorType, startOffsetSec});

  it('lays out backwards and forwards from the anchor', () => {
    const times = layOutTimes([row(600), row(0, 'MATCH_START'), row(2100)], {kickoff, liveStart});
    expect(times.map((t) => t.timeStart?.toISOString())).toEqual(['2026-11-14T19:20:00.000Z', '2026-11-14T19:30:00.000Z', '2026-11-14T19:30:00.000Z']);
    expect(times[2].timeEnd?.toISOString()).toBe('2026-11-14T20:05:00.000Z');
    expect(layOutTimes([row(60, 'LIVESTREAM_START')], {kickoff, liveStart})[0].timeStart).toEqual(liveStart);
  });

  it('starts every anchor at its own time: the room or overrun before the match start falls just before it', () => {
    // Live 19:00, 10 min of program, then the oploop: kickoff stays at 19:30
    const room = layOutTimes([row(60), row(0, 'LIVESTREAM_START'), row(600), row(120), row(0, 'MATCH_START'), row(2100)], {kickoff, liveStart});
    expect(room.map((t) => t.timeStart?.toISOString().slice(11, 16))).toEqual(['18:59', '19:00', '19:00', '19:10', '19:30', '19:30']);
    // 40 min of program before a 19:30 kickoff: still 19:30
    const overrun = layOutTimes([row(0, 'LIVESTREAM_START'), row(2400), row(0, 'MATCH_START')], {kickoff, liveStart});
    expect(overrun.map((t) => t.timeStart?.toISOString().slice(11, 16))).toEqual(['19:00', '19:00', '19:30']);
  });

  it('uses the offset from the kickoff without an anchor, else no time', () => {
    const times = layOutTimes([row(60, null, -300), row(60)], {kickoff, liveStart});
    expect(times[0].timeStart?.toISOString()).toBe('2026-11-14T19:25:00.000Z');
    expect(times[1]).toEqual({timeStart: null, timeEnd: null});
  });
});

describe('draaiboekFromProductionExport', () => {
  it('takes the draaiboek of a whole production export, with each item\'s hoofdstuk by name', () => {
    const file = draaiboekFromProductionExport({
      version: 1,
      chapters: [{name: 'Rust', orderIndex: 2, minDurationSec: 600}, {name: 'Voorbeschouwing', orderIndex: 1, minDurationSec: null}],
      callSheets: [{name: 'Korfbal League', items: [
        {id: 'b', title: 'Rustinterview', orderIndex: 1, chapterOrderIndex: 2},
        {id: 'a', title: 'Opening', orderIndex: 0, chapterOrderIndex: 1, isInVenue: true},
      ]}],
    });
    expect(file?.name).toBe('Korfbal League');
    expect(file?.chapters).toEqual([{name: 'Voorbeschouwing', minDurationSec: null}, {name: 'Rust', minDurationSec: 600}]);
    expect(file?.items).toEqual([
      {id: 'a', title: 'Opening', orderIndex: 0, isInVenue: true, chapter: 'Voorbeschouwing'},
      {id: 'b', title: 'Rustinterview', orderIndex: 1, chapter: 'Rust'},
    ]);
  });

  it('leaves a draaiboek file and anything else alone', () => {
    expect(draaiboekFromProductionExport({version: 2, items: [], callSheets: []})).toBeNull();
    expect(draaiboekFromProductionExport({callSheets: [{name: 'x'}]})).toBeNull();
    expect(draaiboekFromProductionExport(null)).toBeNull();
  });
});
