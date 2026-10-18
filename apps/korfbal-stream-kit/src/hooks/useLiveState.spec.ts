import {describe, expect, it} from 'vitest';
import {formatSystemTime, formatTime} from './useLiveState';

describe('useLiveState - formatSystemTime (the "Tijd" clock)', () => {
  it('shows the wall clock in Amsterdam, whatever the device zone (tests run in UTC)', () => {
    expect(formatSystemTime(new Date('2026-11-14T18:30:05.000Z'))).toBe('19:30:05');
    expect(formatSystemTime(new Date('2026-06-13T17:30:05.000Z'))).toBe('19:30:05');
  });
});

describe('useLiveState - formatTime', () => {
  it('should format seconds into MM:SS correctly', () => {
    expect(formatTime(65)).toEqual({
      minutes: '01',
      seconds: '05',
      isNegative: false,
      rawSeconds: 65
    });
  });

  it('should handle zero seconds', () => {
    expect(formatTime(0)).toEqual({
      minutes: '00',
      seconds: '00',
      isNegative: false,
      rawSeconds: 0
    });
  });

  it('should handle negative seconds', () => {
    expect(formatTime(-10)).toEqual({
      minutes: '00',
      seconds: '10',
      isNegative: true,
      rawSeconds: -10
    });
  });

  it('should handle large amounts of seconds', () => {
    expect(formatTime(3665)).toEqual({
      minutes: '61',
      seconds: '05',
      isNegative: false,
      rawSeconds: 3665
    });
  });

  it('should round the seconds', () => {
    expect(formatTime(65.9)).toEqual({
      minutes: '01',
      seconds: '06',
      isNegative: false,
      rawSeconds: 65.9
    });
  });
});
