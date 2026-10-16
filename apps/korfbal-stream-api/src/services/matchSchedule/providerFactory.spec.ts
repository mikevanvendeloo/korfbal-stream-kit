import {describe, expect, it} from 'vitest';
import {createMatchScheduleProvider} from './providerFactory';
import {VrijwilligersMatchScheduleProvider} from './VrijwilligersMatchScheduleProvider';

describe('createMatchScheduleProvider', () => {
  it('returns a VrijwilligersMatchScheduleProvider for the "vrijwilligers" provider', () => {
    const provider = createMatchScheduleProvider({provider: 'vrijwilligers', baseUrl: 'https://example.com/v1'});
    expect(provider).toBeInstanceOf(VrijwilligersMatchScheduleProvider);
  });

  it('throws a clear error for an unknown provider', () => {
    expect(() => createMatchScheduleProvider({provider: 'sportlink', baseUrl: 'https://example.com'})).toThrow(
      /Unknown match source provider "sportlink"/
    );
  });
});
