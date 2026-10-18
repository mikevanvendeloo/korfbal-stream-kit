import {describe, expect, it} from 'vitest';
import {
  amsterdamDay,
  amsterdamDayRange,
  amsterdamToUtc,
  excelCellToDate,
  formatDate,
  formatDateTime,
  formatTime,
  fromAmsterdamInput,
  parseInstant,
  parseOptionalInstant,
  toAmsterdamInputValue,
} from './time';

// The suite runs with TZ=UTC by default (vitest.config.ts) and passes with any TZ, e.g.
// TZ=America/New_York: none of this may depend on the server's zone.
describe('utils/time (Europe/Amsterdam)', () => {
  it('formats a winter time (CET, +01:00)', () => {
    expect(formatTime('2026-11-14T18:30:00.000Z')).toBe('19:30');
    expect(formatTime(new Date('2026-11-14T18:30:05.000Z'), {seconds: true})).toBe('19:30:05');
    expect(formatDate('2026-11-14T18:30:00.000Z')).toBe('14-11-2026');
    expect(formatDateTime('2026-11-14T18:30:00.000Z')).toBe('14-11-2026 19:30');
    expect(formatDate('2026-11-14T18:30:00.000Z', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}))
      .toBe('zaterdag 14 november 2026');
  });

  it('formats a summer time (CEST, +02:00)', () => {
    expect(formatTime('2026-06-13T17:30:00.000Z')).toBe('19:30');
  });

  it('uses the Amsterdam day, also late in the evening and around midnight', () => {
    // 23:30 UTC on 14 November is already 15 November in Amsterdam
    expect(amsterdamDay('2026-11-14T23:30:00.000Z')).toBe('2026-11-15');
    expect(formatTime('2026-11-14T23:00:00.000Z')).toBe('00:00');
  });

  it('gives empty text for empty or invalid values', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('nonsense')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(toAmsterdamInputValue('')).toBe('');
  });

  it('round-trips a datetime-local value', () => {
    expect(toAmsterdamInputValue('2026-11-14T18:30:00.000Z')).toBe('2026-11-14T19:30');
    expect(fromAmsterdamInput('2026-11-14T19:30')).toBe('2026-11-14T18:30:00.000Z');
    expect(fromAmsterdamInput('2026-06-13T19:30')).toBe('2026-06-13T17:30:00.000Z');
    expect(fromAmsterdamInput('2026-11-14')).toBe('2026-11-13T23:00:00.000Z');
  });

  describe('DST switches', () => {
    // Last Sunday of October: 03:00 CEST → 02:00 CET, so 02:00–02:59 happens twice
    it('takes the first occurrence (summer time) of the repeated hour in October', () => {
      expect(fromAmsterdamInput('2026-10-25T02:30')).toBe('2026-10-25T00:30:00.000Z');
      // Both instants are shown as 02:30
      expect(formatTime('2026-10-25T00:30:00.000Z')).toBe('02:30');
      expect(formatTime('2026-10-25T01:30:00.000Z')).toBe('02:30');
      expect(fromAmsterdamInput('2026-10-25T01:59')).toBe('2026-10-24T23:59:00.000Z');
      expect(fromAmsterdamInput('2026-10-25T03:00')).toBe('2026-10-25T02:00:00.000Z');
    });

    // Last Sunday of March: 02:00 CET → 03:00 CEST, so 02:00–02:59 doesn't exist
    it('moves a time in the skipped hour in March forward by the gap', () => {
      expect(fromAmsterdamInput('2027-03-28T02:30')).toBe('2027-03-28T01:30:00.000Z');
      expect(formatTime('2027-03-28T01:30:00.000Z')).toBe('03:30');
      expect(fromAmsterdamInput('2027-03-28T01:59')).toBe('2027-03-28T00:59:00.000Z');
      expect(fromAmsterdamInput('2027-03-28T03:00')).toBe('2027-03-28T01:00:00.000Z');
    });

    it('gives the 23- and 25-hour days their real length', () => {
      const march = amsterdamDayRange('2027-03-28');
      expect(march.start.toISOString()).toBe('2027-03-27T23:00:00.000Z');
      expect((march.end.getTime() - march.start.getTime()) / 3_600_000).toBe(23);
      const october = amsterdamDayRange('2026-10-25');
      expect((october.end.getTime() - october.start.getTime()) / 3_600_000).toBe(25);
    });

    it('converts wall-clock parts the same way', () => {
      expect(amsterdamToUtc(2026, 7, 1).toISOString()).toBe('2026-06-30T22:00:00.000Z');
      expect(amsterdamToUtc(2026, 10, 25, 2, 30).toISOString()).toBe('2026-10-25T00:30:00.000Z');
    });
  });

  describe('parseInstant (input from outside)', () => {
    it('accepts UTC, an offset, and a time without zone as Amsterdam time', () => {
      expect(parseInstant('2026-11-14T18:30:00.000Z')?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
      expect(parseInstant('2026-11-14T19:30:00+01:00')?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
      expect(parseInstant('2026-11-14T13:30:00-0500')?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
      expect(parseInstant('2026-11-14T19:30')?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
      expect(parseInstant('2026-11-14 19:30:00')?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
      expect(parseInstant(new Date('2026-11-14T18:30:00.000Z'))?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
    });

    it.each([
      'nonsense', '', '2026-02-31T18:30:00Z', '2026-13-01T00:00:00Z', '2026-11-14T24:00', '2026-11-14T19:60',
      '2026-11-14T19:30:00+25:00', '14-11-2026 19:30', '1e12', 'x'.repeat(10_000),
    ])('rejects %j', (value) => {
      expect(parseInstant(value)).toBeNull();
    });

    it.each([1_700_000_000_000, {}, [], true, new Date('invalid')])('rejects %j', (value) => {
      expect(parseInstant(value)).toBeNull();
    });

    it('tells empty, valid and invalid optional fields apart', () => {
      expect(parseOptionalInstant(undefined)).toBeNull();
      expect(parseOptionalInstant('')).toBeNull();
      expect(parseOptionalInstant('2026-11-14T18:30:00Z')).toEqual(new Date('2026-11-14T18:30:00Z'));
      expect(parseOptionalInstant('31-02-2026')).toBe('invalid');
    });
  });

  it('refuses years outside 1900-2200 (the database and Intl would fail on them)', () => {
    expect(parseInstant('9999-12-31T23:59:59-14:00')).toBeNull();
    expect(parseInstant('1899-12-31T23:00:00Z')).toBeNull();
    expect(parseInstant(new Date(8.64e15))).toBeNull();
    expect(parseInstant('2200-06-01T12:00:00Z')?.toISOString()).toBe('2200-06-01T12:00:00.000Z');
  });

  it('gives null for an Excel cell at the edge of the Date range instead of throwing', () => {
    expect(() => excelCellToDate(new Date(8.64e15))).not.toThrow();
    expect(excelCellToDate(new Date(8.64e15))).toBeNull();
    expect(excelCellToDate(new Date(-8.64e15))).toBeNull();
  });

  it('reads an Excel time cell (wall clock as UTC) as Amsterdam time', () => {
    expect(excelCellToDate(new Date('2026-11-14T19:30:00.000Z'))?.toISOString()).toBe('2026-11-14T18:30:00.000Z');
    expect(excelCellToDate(new Date('2026-06-13T19:30:00.000Z'))?.toISOString()).toBe('2026-06-13T17:30:00.000Z');
  });
});
