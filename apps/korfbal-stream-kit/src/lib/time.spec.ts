import {describe, expect, it} from 'vitest';
import {
  amsterdamDay,
  atAmsterdamTime,
  formatDate,
  formatDateTime,
  formatTime,
  fromAmsterdamInput,
  toAmsterdamInputValue,
  todayAmsterdam,
} from './time';

describe('lib/time (Europe/Amsterdam on any device)', () => {
  it('runs in a zone other than Amsterdam (vite.config.ts sets TZ=UTC)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe('Europe/Amsterdam');
  });

  it('shows UTC times as Amsterdam time, winter and summer', () => {
    expect(formatTime('2026-11-14T18:30:00.000Z')).toBe('19:30');
    expect(formatTime('2026-06-13T17:30:00.000Z')).toBe('19:30');
    expect(formatTime('2026-11-14T18:30:05.000Z', {seconds: true})).toBe('19:30:05');
    expect(formatDateTime('2026-11-14T18:30:00.000Z')).toBe('14-11-2026 19:30');
    expect(formatDate('2026-11-14T18:30:00.000Z', {weekday: 'short', day: '2-digit', month: 'short'})).toBe('za 14 nov');
    expect(formatTime(null, {fallback: '--:--'})).toBe('--:--');
  });

  it('fills a datetime-local field with Amsterdam time and reads it back as UTC', () => {
    expect(toAmsterdamInputValue('2026-11-14T18:30:00.000Z')).toBe('2026-11-14T19:30');
    expect(fromAmsterdamInput('2026-11-14T19:30')).toBe('2026-11-14T18:30:00.000Z');
    expect(fromAmsterdamInput('2026-06-13T19:30')).toBe('2026-06-13T17:30:00.000Z');
    expect(fromAmsterdamInput('2026-02-31T19:30')).toBeNull();
    expect(fromAmsterdamInput('nonsense')).toBeNull();
  });

  it('handles the DST switches like the API (first occurrence in October, forward in March)', () => {
    expect(fromAmsterdamInput('2026-10-25T02:30')).toBe('2026-10-25T00:30:00.000Z');
    expect(fromAmsterdamInput('2027-03-28T02:30')).toBe('2027-03-28T01:30:00.000Z');
  });

  it('uses the Amsterdam day', () => {
    expect(amsterdamDay('2026-11-14T23:30:00.000Z')).toBe('2026-11-15');
    expect(todayAmsterdam(new Date('2026-11-14T23:30:00.000Z'))).toBe('2026-11-15');
    // A live time typed as 19:25 on the day of a match at 00:30 Amsterdam (23:30Z the day before)
    expect(atAmsterdamTime('2026-11-14T23:30:00.000Z', '19:25')).toBe('2026-11-15T18:25:00.000Z');
    expect(atAmsterdamTime('2026-06-13', '19:25')).toBe('2026-06-13T17:25:00.000Z');
  });
});
