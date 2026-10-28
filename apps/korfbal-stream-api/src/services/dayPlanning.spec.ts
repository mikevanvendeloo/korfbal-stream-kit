import {describe, expect, it} from 'vitest';
import {DEFAULT_DAY_PLANNING, planDay, PlanningInput} from './dayPlanning';

const at = (iso: string) => new Date(iso);
const production = (id: number, liveTime: string | null, extra: Partial<PlanningInput> = {}): PlanningInput => ({
  id, liveTime: liveTime ? at(liveTime) : null, setupTime: null, crewCallTime: null,
  matchSchedule: {date: at('2026-11-14T18:30:00.000Z')}, ...extra,
});

describe('planDay', () => {
  it('plans opbouw 2.5 h before the first stream and verzamelen 30 min before each stream', () => {
    const plan = planDay([production(2, '2026-11-14T18:15:00.000Z'), production(1, '2026-11-14T14:15:00.000Z')], DEFAULT_DAY_PLANNING);
    expect(plan.get(1)).toEqual({
      liveStart: at('2026-11-14T14:15:00.000Z'), isFirstOfDay: true,
      setupTime: at('2026-11-14T11:45:00.000Z'), setupIsDefault: true,
      crewCallTime: at('2026-11-14T13:45:00.000Z'), crewCallIsDefault: true,
    });
    expect(plan.get(2)).toMatchObject({isFirstOfDay: false, setupTime: null, setupIsDefault: false, crewCallTime: at('2026-11-14T17:45:00.000Z')});
  });

  it('takes the production\'s own times over the defaults', () => {
    const plan = planDay([production(1, '2026-11-14T14:15:00.000Z', {setupTime: at('2026-11-14T10:00:00.000Z'), crewCallTime: at('2026-11-14T13:00:00.000Z')})], DEFAULT_DAY_PLANNING);
    expect(plan.get(1)).toMatchObject({setupTime: at('2026-11-14T10:00:00.000Z'), setupIsDefault: false, crewCallTime: at('2026-11-14T13:00:00.000Z'), crewCallIsDefault: false});
  });

  it('counts from the match start without a liveTime, with the organization\'s minutes', () => {
    const plan = planDay([production(1, null)], {crewCallMinutes: 45, setupMinutes: 120});
    expect(plan.get(1)).toMatchObject({liveStart: at('2026-11-14T18:30:00.000Z'), crewCallTime: at('2026-11-14T17:45:00.000Z'), setupTime: at('2026-11-14T16:30:00.000Z')});
  });

  it('only gives the first stream an opbouw time, also when a later one has its own', () => {
    const plan = planDay([production(1, '2026-11-14T14:15:00.000Z'), production(2, '2026-11-14T18:15:00.000Z', {setupTime: at('2026-11-14T16:00:00.000Z')})], DEFAULT_DAY_PLANNING);
    expect(plan.get(2)?.setupTime).toBeNull();
  });
});
