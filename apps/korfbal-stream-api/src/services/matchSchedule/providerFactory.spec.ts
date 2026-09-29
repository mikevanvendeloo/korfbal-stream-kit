import {describe, expect, it} from 'vitest';
import {createMatchScheduleProvider} from './providerFactory';
import {VrijwilligersMatchScheduleProvider} from './VrijwilligersMatchScheduleProvider';

describe('createMatchScheduleProvider', () => {
  it('returns a VrijwilligersMatchScheduleProvider for the "vrijwilligers" key', () => {
    const provider = createMatchScheduleProvider('vrijwilligers');
    expect(provider).toBeInstanceOf(VrijwilligersMatchScheduleProvider);
  });

  it('throws a clear error for an unknown provider key', () => {
    expect(() => createMatchScheduleProvider('sportlink')).toThrow(
      /Unknown MATCH_SCHEDULE_PROVIDER "sportlink"/
    );
  });
});
