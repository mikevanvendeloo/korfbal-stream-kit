import {describe, expect, it} from 'vitest';
import {chapterTime, flattenChapters, placeItemsInChapters, segmentWindows, sequentialStarts, structureProblem, type TimedItem} from './chapters';

const MIN = 60_000;
const item = (id: string, durationSec: number, extra: Partial<TimedItem> = {}): TimedItem =>
  ({id, durationSec, isTimeAnchor: false, anchorType: null, ...extra});

describe('segmentWindows', () => {
  it('anchors the anchor segment at the kickoff, the others after and before it', () => {
    const windows = segmentWindows([
      {key: 'voor', duurInMinuten: 20, isTimeAnchor: false},
      {key: 'eerste', duurInMinuten: 35, isTimeAnchor: true},
      {key: 'rust', duurInMinuten: 10, isTimeAnchor: false},
    ], 0);
    expect(windows).toEqual([
      {key: 'voor', start: -20 * MIN, end: 0},
      {key: 'eerste', start: 0, end: 35 * MIN},
      {key: 'rust', start: 35 * MIN, end: 45 * MIN},
    ]);
  });

  it('takes the first segment as anchor when none is marked', () => {
    expect(segmentWindows([{key: 'a', duurInMinuten: 10, isTimeAnchor: false}], 100)).toEqual([{key: 'a', start: 100, end: 100 + 10 * MIN}]);
  });
});

describe('sequentialStarts', () => {
  it('lays the items out from the match start anchor, also when a livestream anchor comes first', () => {
    const items = [
      item('check', 1200),
      item('live', 0, {isTimeAnchor: true, anchorType: 'LIVESTREAM_START'}),
      item('welkom', 600),
      item('aftrap', 0, {isTimeAnchor: true, anchorType: 'MATCH_START'}),
      item('helft', 2100),
      item('rust', 600),
    ];
    const starts = sequentialStarts(items, {MATCH_START: 0, LIVESTREAM_START: -5 * MIN});
    expect(Object.fromEntries(starts)).toEqual({
      check: -30 * MIN, live: -10 * MIN, welkom: -10 * MIN, aftrap: 0, helft: 0, rust: 35 * MIN,
    });
  });

  it('uses the livestream start for a draaiboek with only that anchor', () => {
    const starts = sequentialStarts([item('live', 0, {isTimeAnchor: true, anchorType: 'LIVESTREAM_START'}), item('a', 60)], {MATCH_START: 0, LIVESTREAM_START: -5 * MIN});
    expect(starts.get('a')).toBe(-5 * MIN);
  });
});

describe('placeItemsInChapters', () => {
  const windows = [
    {key: 'voor', start: -20 * MIN, end: 0},
    {key: 'eerste', start: 0, end: 35 * MIN},
    {key: 'rust', start: 35 * MIN, end: 45 * MIN},
  ];

  it('puts an item in the window holding its start; a boundary belongs to the next window', () => {
    const placement = placeItemsInChapters(windows, [
      {id: 'a', start: -20 * MIN}, {id: 'b', start: -1}, {id: 'c', start: 0}, {id: 'd', start: 35 * MIN},
    ]);
    expect(Object.fromEntries(placement)).toEqual({a: 'voor', b: 'voor', c: 'eerste', d: 'rust'});
  });

  it('puts items before the first window in Voorbereiding (BEFORE) and after the last in the last', () => {
    const placement = placeItemsInChapters(windows, [{id: 'early', start: -30 * MIN}, {id: 'late', start: 90 * MIN}]);
    expect(Object.fromEntries(placement)).toEqual({early: 'BEFORE', late: 'rust'});
  });

  it('lets a linked item follow its parent and an item without a time follow the one before it', () => {
    const placement = placeItemsInChapters(windows, [
      {id: 'parent', start: -5 * MIN}, {id: 'child', start: 10 * MIN, parentId: 'parent'}, {id: 'loose', start: null},
    ]);
    expect(Object.fromEntries(placement)).toEqual({parent: 'voor', child: 'voor', loose: 'voor'});
  });

  it('places nothing without windows', () => {
    expect(placeItemsInChapters([], [{id: 'a', start: 0}]).size).toBe(0);
  });
});

describe('chapterTime', () => {
  it('runs from the first start to the latest end of its items', () => {
    const at = (m: number) => new Date(Date.UTC(2026, 10, 14, 18, m));
    expect(chapterTime([
      {timeStart: at(10), timeEnd: at(20)}, {timeStart: at(0), timeEnd: at(5)}, {timeStart: at(20), timeEnd: null},
    ])).toEqual({start: at(0), end: at(20), durationMinutes: 20});
  });

  it('has no time without timed items', () => {
    expect(chapterTime([{timeStart: null, timeEnd: null}])).toEqual({start: null, end: null, durationMinutes: 0});
  });
});

describe('structureProblem and flattenChapters', () => {
  const items = [{id: 'a', parentId: null}, {id: 'b', parentId: 'a'}, {id: 'c', parentId: null}];

  it('accepts a complete structure and flattens it in hoofdstuk order', () => {
    const structure = [{id: 'voor', itemIds: ['c']}, {id: 'na', itemIds: ['a', 'b']}];
    expect(structureProblem(structure, ['na', 'voor'], items)).toBeNull();
    expect(flattenChapters(structure)).toEqual([
      {itemId: 'c', chapterId: 'voor', orderIndex: 1}, {itemId: 'a', chapterId: 'na', orderIndex: 2}, {itemId: 'b', chapterId: 'na', orderIndex: 3},
    ]);
  });

  it('refuses an unknown or missing hoofdstuk, and a missing, double or unknown item', () => {
    expect(structureProblem([{id: 'x', itemIds: ['a', 'b', 'c']}], ['voor'], items)).toBe('Onbekend hoofdstuk');
    expect(structureProblem([{id: 'voor', itemIds: ['a', 'b', 'c']}], ['voor', 'na'], items)).toBe('Elk hoofdstuk moet precies één keer voorkomen');
    expect(structureProblem([{id: 'voor', itemIds: ['a', 'b']}], ['voor'], items)).toBe('Elk item moet precies één keer voorkomen');
    expect(structureProblem([{id: 'voor', itemIds: ['a', 'b', 'c', 'c']}], ['voor'], items)).toBe('Elk item moet precies één keer voorkomen');
    expect(structureProblem([{id: 'voor', itemIds: ['a', 'b', 'z']}], ['voor'], items)).toBe('Elk item moet precies één keer voorkomen');
  });

  it('keeps a linked item with its parent', () => {
    expect(structureProblem([{id: 'voor', itemIds: ['a', 'c']}, {id: 'na', itemIds: ['b']}], ['voor', 'na'], items))
      .toBe('Een gekoppeld item hoort in het hoofdstuk van zijn hoofditem');
  });
});
