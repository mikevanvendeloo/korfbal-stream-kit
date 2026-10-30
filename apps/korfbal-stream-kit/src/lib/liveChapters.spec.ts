import {describe, expect, it} from 'vitest';
import {chapterName, chapterTimes, currentChapter, minutesSeconds, withChapterHeadings} from './liveChapters';
import {rustChapters, rustItems, showItem} from '../test/showCaller';

const chapters = [{id: 1, name: 'Voorbeschouwing', order: 1}, {id: 2, name: 'Eerste helft', order: 2}];
const events = [
  showItem('a', 1, 'Welkom', {chapterId: 1, durationSec: 60, status: 'COMPLETED'}),
  showItem('b', 2, 'Interview', {chapterId: 1, durationSec: 180, status: 'ACTIVE'}),
  showItem('c', 3, 'Camera op coach', {chapterId: 1, durationSec: 30, parentId: 'b'}),
  showItem('d', 4, 'Opstellingen', {chapterId: 1, durationSec: 120}),
  showItem('e', 5, 'Aftrap', {chapterId: 2, durationSec: 0}),
];

describe('liveChapters', () => {
  it('names the hoofdstuk of an item', () => {
    expect(chapterName(chapters, 2)).toBe('Eerste helft');
    expect(chapterName(chapters, null)).toBeNull();
  });

  it('gives the current hoofdstuk with the rest of the active item plus the later items (not the linked ones)', () => {
    expect(currentChapter(events, 'b', 90, chapters)).toEqual({name: 'Voorbeschouwing', remainingSec: 90 + 120});
    // Over time the active item adds nothing
    expect(currentChapter(events, 'b', -15, chapters)).toEqual({name: 'Voorbeschouwing', remainingSec: 120});
    expect(currentChapter(events, null, null, chapters)).toBeNull();
  });

  it('gives the planned start and end of every hoofdstuk', () => {
    const times = chapterTimes(events, chapters);
    // showItem plans one minute apart from 19:50 (local test data): a starts at 19:51, d ends 19:54 + 2:00
    expect(times.get(1)?.start).toEqual(events[0].calculatedTime);
    expect(times.get(1)?.end).toEqual(new Date(events[3].calculatedTime.getTime() + 120_000));
    expect(times.get(2)?.start).toEqual(events[4].calculatedTime);
  });

  it('formats minutes and seconds', () => {
    expect(minutesSeconds(750)).toBe('12:30');
    expect(minutesSeconds(-4)).toBe('0:00');
  });
});

describe('withChapterHeadings', () => {
  it('groups the time slots per hoofdstuk behind a heading, also for an empty one', () => {
    const at = (m: number) => new Date(Date.UTC(2026, 10, 14, 18, m));
    const items = [{chapterId: 1, calculatedTime: at(0)}, {chapterId: 2, calculatedTime: at(30)}, {chapterId: null, calculatedTime: at(50)}];
    const slots = [`${at(0).toISOString()}#0`, `${at(30).toISOString()}#0`, `${at(50).toISOString()}#0`];
    expect(withChapterHeadings(slots, items, [...chapters, {id: 3, name: 'Rust', order: 3}])).toEqual([
      'chapter:1', slots[0], 'chapter:2', slots[1], 'chapter:3', slots[2],
    ]);
    expect(withChapterHeadings(slots, items, [])).toEqual(slots);
  });
});

describe('currentChapter with parallel lanes', () => {
  const now = new Date(2026, 9, 17, 20, 0).getTime();
  const started = rustItems.map((e) => (e.id === 'r1' ? {...e, actualStartTime: new Date(now - 60_000)} : e)) as typeof rustItems;
  const withoutMinimum = rustChapters.map((c) => ({...c, minDurationSec: null}));

  it('lasts as long as the longer lane: the stream with the analysis, the hall with the statistics', () => {
    // Stream: 100 s of the commentators + 240 s analysis; hall: 50 s LED + 60 s statistics
    expect(currentChapter(started, 'r3', 100, withoutMinimum, {id: 'r2', remainingSec: 50}, now)).toEqual({name: 'Rust', remainingSec: 340});
    // A longer hall lane wins
    expect(currentChapter(started, 'r3', 10, withoutMinimum, {id: 'r2', remainingSec: 400}, now)).toEqual({name: 'Rust', remainingSec: 460});
  });

  it('ends no earlier than the start of the hoofdstuk plus its Minimale duur', () => {
    // Started a minute ago, at least 10 minutes: 9 minutes to go
    expect(currentChapter(started, 'r3', 100, rustChapters, {id: 'r2', remainingSec: 50}, now)).toEqual({name: 'Rust', remainingSec: 540});
  });
});
