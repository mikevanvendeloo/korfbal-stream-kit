import {describe, expect, it} from 'vitest';
import {showsVenueClock} from './venueClock';

describe('showsVenueClock', () => {
  it('is false without a running item or when none wants the clock', () => {
    expect(showsVenueClock(null, null)).toBe(false);
    expect(showsVenueClock({showVenueClock: false}, {showVenueClock: false})).toBe(false);
    expect(showsVenueClock({}, undefined)).toBe(false);
  });

  it('is true when the stream item wants it', () => {
    expect(showsVenueClock({showVenueClock: true}, null)).toBe(true);
  });

  it('is true when the hall item wants it', () => {
    expect(showsVenueClock({showVenueClock: false}, {showVenueClock: true})).toBe(true);
  });
});
