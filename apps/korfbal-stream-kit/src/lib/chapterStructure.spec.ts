import {describe, expect, it} from 'vitest';
import {appendItem, buildStructure, formatRelative, keepLinkedTogether, linkedMoveNotice, moveChapter, moveItem, relativeChapterTimes, removeChapter} from './chapterStructure';

const structure = () => buildStructure(
  [{id: 'voor'}, {id: 'eerste'}, {id: 'rust'}],
  [{id: 'kabels', chapterId: 'voor'}, {id: 'aftrap', chapterId: 'eerste'}, {id: 'camera', chapterId: 'eerste'}, {id: 'helft', chapterId: 'eerste'}, {id: 'pauze', chapterId: 'rust'}],
);

describe('chapterStructure', () => {
  it('groups the items per hoofdstuk in show order; an item without hoofdstuk joins the last', () => {
    expect(buildStructure([{id: 1}, {id: 2}], [{id: 'a', chapterId: 2}, {id: 'b', chapterId: null}, {id: 'c', chapterId: 1}]))
      .toEqual([{id: 1, itemIds: ['c']}, {id: 2, itemIds: ['a', 'b']}]);
  });

  it('moves an item within and between hoofdstukken', () => {
    expect(moveItem(structure(), 'helft', 'eerste', 0)[1].itemIds).toEqual(['helft', 'aftrap', 'camera']);
    const moved = moveItem(structure(), 'pauze', 'voor', 1);
    expect(moved.map((c) => c.itemIds)).toEqual([['kabels', 'pauze'], ['aftrap', 'camera', 'helft'], []]);
  });

  it('moves a whole hoofdstuk with its items', () => {
    expect(moveChapter(structure(), 'rust', 0).map((c) => c.id)).toEqual(['rust', 'voor', 'eerste']);
  });

  it('adds a new item at the end of a hoofdstuk', () => {
    expect(appendItem(structure(), 'voor', 'nieuw')[0].itemIds).toEqual(['kabels', 'nieuw']);
  });

  it('keeps a linked item with its parent, right after the parent and its other linked items', () => {
    const items = [{id: 'aftrap'}, {id: 'camera', parentId: 'aftrap'}, {id: 'licht', parentId: 'aftrap'}, {id: 'helft'}];
    const start = buildStructure([{id: 'voor'}, {id: 'eerste'}], [
      {id: 'aftrap', chapterId: 'voor'}, {id: 'camera', chapterId: 'eerste'}, {id: 'licht', chapterId: 'eerste'}, {id: 'helft', chapterId: 'eerste'},
    ]);
    expect(keepLinkedTogether(start, items)).toEqual([{id: 'voor', itemIds: ['aftrap', 'camera', 'licht']}, {id: 'eerste', itemIds: ['helft']}]);
  });

  it('removes a hoofdstuk and moves its items to the end of another one', () => {
    expect(removeChapter(structure(), 'eerste', 'rust')).toEqual([
      {id: 'voor', itemIds: ['kabels']}, {id: 'rust', itemIds: ['pauze', 'aftrap', 'camera', 'helft']},
    ]);
  });
});

describe('relativeChapterTimes', () => {
  it('times the hoofdstukken from the match start anchor', () => {
    const s = buildStructure([{id: 'voor'}, {id: 'eerste'}], [
      {id: 'kabels', chapterId: 'voor'}, {id: 'welkom', chapterId: 'voor'}, {id: 'aftrap', chapterId: 'eerste'}, {id: 'helft', chapterId: 'eerste'},
    ]);
    const items = [
      {id: 'kabels', durationSec: 1200, isTimeAnchor: false, anchorType: null},
      {id: 'welkom', durationSec: 600, isTimeAnchor: true, anchorType: 'LIVESTREAM_START'},
      {id: 'aftrap', durationSec: 0, isTimeAnchor: true, anchorType: 'MATCH_START'},
      {id: 'helft', durationSec: 2100, isTimeAnchor: false, anchorType: null},
    ];
    const times = relativeChapterTimes(s, items);
    expect(times.get('voor')).toEqual({start: -1800, end: 0});
    expect(times.get('eerste')).toEqual({start: 0, end: 2100});
    expect(formatRelative(-1800)).toBe('−30:00');
    expect(formatRelative(2100)).toBe('+35:00');
  });
});

describe('linkedMoveNotice', () => {
  const items = [{id: 'aftrap', title: 'Aftrap'}, {id: 'camera', title: 'Camera op middenstip', parentId: 'aftrap'}, {id: 'helft', title: 'Eerste helft'}];
  const s = buildStructure([{id: 'voor'}, {id: 'eerste'}], [{id: 'aftrap', chapterId: 'eerste'}, {id: 'camera', chapterId: 'eerste'}, {id: 'helft', chapterId: 'eerste'}]);

  it('explains why a linked item stays with its parent', () => {
    expect(linkedMoveNotice(s, items, 'camera', 'voor', (it) => it.title)).toBe(
      '"Camera op middenstip" is gekoppeld aan "Aftrap" en blijft in hetzelfde hoofdstuk. Sleep "Aftrap": de gekoppelde items gaan mee. Of maak de koppeling los.');
  });

  it('says nothing for a move within the parent\'s hoofdstuk or for an item without parent', () => {
    expect(linkedMoveNotice(s, items, 'camera', 'eerste', (it) => it.title)).toBeNull();
    expect(linkedMoveNotice(s, items, 'helft', 'voor', (it) => it.title)).toBeNull();
  });
});
