import {describe, expect, it} from 'vitest';
import {blockIndexes, chapterSpan, hallLaneItems, laneOf, LaneItem, layOutLaneTimes, relayOutFrom} from './laneTimes';

const kickoff = new Date('2026-11-14T19:30:00Z');
const liveStart = new Date('2026-11-14T19:00:00Z');
const MIN = 60;

const item = (durationMin: number, extra: Partial<LaneItem> = {}): LaneItem => ({
  durationSec: durationMin * MIN, isTimeAnchor: false, anchorType: null, isInVenue: false, isInLivestream: true, chapterId: 'A', ...extra,
});
const zaal = (durationMin: number, extra: Partial<LaneItem> = {}) => item(durationMin, {isInVenue: true, isInLivestream: false, ...extra});
const join = (durationMin: number, extra: Partial<LaneItem> = {}) => item(durationMin, {isInVenue: true, isInLivestream: true, ...extra});
const kick = (durationMin: number, extra: Partial<LaneItem> = {}) => item(durationMin, {isTimeAnchor: true, anchorType: 'MATCH_START', ...extra});
/** Minutes relative to the kickoff of each item's start */
const starts = (items: LaneItem[], minimums?: Map<string, number | null>) =>
  layOutLaneTimes(items, {kickoff, liveStart, chapterMinimums: minimums})
    .map((t) => (t.timeStart ? (t.timeStart.getTime() - kickoff.getTime()) / 60000 : null));

describe('laneOf', () => {
  it('Zaal only, Stream only, both/neither and anchors', () => {
    expect(laneOf({isTimeAnchor: false, isInVenue: true, isInLivestream: false})).toBe('ZAAL');
    expect(laneOf({isTimeAnchor: false, isInVenue: false, isInLivestream: true})).toBe('STREAM');
    expect(laneOf({isTimeAnchor: false, isInVenue: true, isInLivestream: true})).toBe('JOIN');
    expect(laneOf({isTimeAnchor: false, isInVenue: false, isInLivestream: false})).toBe('JOIN');
    expect(laneOf({isTimeAnchor: true, isInVenue: true, isInLivestream: false})).toBe('JOIN');
    expect(laneOf({isTimeAnchor: false})).toBe('JOIN');
  });
});

describe('layOutLaneTimes', () => {
  it('without lanes: end to end, as before', () => {
    const items = [{durationSec: 300, isTimeAnchor: false, anchorType: null}, {durationSec: 600, isTimeAnchor: true, anchorType: 'MATCH_START'}, {durationSec: 120, isTimeAnchor: false, anchorType: null}];
    expect(starts(items)).toEqual([-5, 0, 10]);
  });

  it('a parallel block: both lanes start together, the next samenkomstpunt after the longest lane', () => {
    // rust: 3 zaal items (2+2+1) and 3 stream items (4+4+2) = 10 minutes, not 15
    const items = [kick(35), zaal(2), item(4), zaal(2), item(4), zaal(1), item(2), join(1)];
    expect(starts(items)).toEqual([0, 35, 35, 37, 39, 39, 43, 45]);
  });

  it('unequal lanes: the longer lane decides', () => {
    expect(starts([kick(1), zaal(8), item(2), join(1)])).toEqual([0, 1, 1, 9]);
  });

  it('a hoofdstuk boundary splits the lanes', () => {
    const items = [kick(1), zaal(5), item(2, {chapterId: 'B'}), join(1, {chapterId: 'B'})];
    expect(starts(items)).toEqual([0, 1, 6, 8]);
  });

  it('a minimum: the next hoofdstuk starts at start + minimum when the items are shorter', () => {
    const items = [kick(20), item(30, {chapterId: 'B'})];
    expect(starts(items, new Map([['A', 35 * MIN]]))).toEqual([0, 35]);
  });

  it('a minimum shorter than the items changes nothing', () => {
    const items = [kick(40), item(30, {chapterId: 'B'})];
    expect(starts(items, new Map([['A', 35 * MIN]]))).toEqual([0, 40]);
  });

  it('backwards: earlier hoofdstukken last at least their minimum', () => {
    const items = [item(5, {chapterId: 'V'}), item(3, {chapterId: 'O'}), kick(35)];
    expect(starts(items, new Map([['O', 10 * MIN]]))).toEqual([-15, -10, 0]);
  });

  it('backwards: a parallel block before the anchor', () => {
    expect(starts([zaal(6), item(3), kick(35)])).toEqual([-6, -6, 0]);
  });

  it('every anchor starts at its own time', () => {
    const items = [item(5), {...item(2), isTimeAnchor: true, anchorType: 'LIVESTREAM_START'}, zaal(10), item(5), kick(35)];
    expect(starts(items)).toEqual([-35, -30, -28, -28, 0]);
  });

  it('without an anchor: the offset from the kickoff', () => {
    expect(starts([item(5, {startOffsetSec: -600}), item(5)])).toEqual([-10, null]);
  });
});

describe('chapterSpan', () => {
  it('end = max(items end, start + minimum), with the overrun', () => {
    expect(chapterSpan({id: 1, minDurationSec: 600}, [{start: 0, end: 300_000}])).toMatchObject({start: 0, itemsEnd: 300_000, end: 600_000, overrunSec: 0});
    expect(chapterSpan({id: 1, minDurationSec: 600}, [{start: 0, end: 720_000}])).toMatchObject({end: 720_000, overrunSec: 120});
    expect(chapterSpan({id: 1}, [{start: null, end: null}])).toMatchObject({start: null, end: null, overrunSec: 0});
  });
});

describe('hallLaneItems and blockIndexes', () => {
  it('Zaal items next to Stream items run by themselves; a Zaal-only block does not', () => {
    const items = [kick(1), zaal(2), item(3), join(1), zaal(2), join(1)];
    expect(blockIndexes(items)).toEqual([0, 1, 1, 2, 3, 4]);
    expect(hallLaneItems(items)).toEqual([false, true, false, false, false, false]);
  });
});

describe('relayOutFrom', () => {
  it('lays out from the active item with lanes, the old anchors are not pinned', () => {
    const items = [item(5), kick(10), zaal(2), item(4), join(1)];
    const at = new Date(kickoff.getTime() + 3 * 60000);
    const times = relayOutFrom(items, 1, at).map((t) => ((t.timeStart?.getTime() ?? NaN) - kickoff.getTime()) / 60000);
    expect(times).toEqual([-2, 3, 13, 13, 17]);
  });
});
