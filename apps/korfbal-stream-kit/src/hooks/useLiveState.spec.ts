import {describe, expect, it} from 'vitest';
import {formatTime} from './useLiveState';

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
