import {describe, expect, it} from 'vitest';
import {
  buildCallsheetTiming,
  formatClock,
  formatVmixTimer,
  parsePositions,
  selectCurrentAndNext,
  TimingEvent,
  timingState
} from './callsheetTiming';

const NOW = new Date('2026-10-12T18:00:00.000Z'); // 20:00 in Amsterdam

function event(id: string, order: number, positions: string[], extra: Partial<TimingEvent> = {}): TimingEvent {
  return {
    id, order, title: `Item ${id}`, status: 'WAITING', durationSec: 60, actualStartTime: null, plannedStartTime: null,
    positions: positions.map((name) => ({position: {name}})),
    ...extra,
  };
}

describe('callsheet timing formatting', () => {
  it('formats clocks like the callsheet, including negative and long times', () => {
    expect(formatClock(272)).toBe('04:32');
    expect(formatClock(-12)).toBe('-00:12');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(null)).toBe('');
  });

  it('formats the vMix countdown value and never goes below zero', () => {
    expect(formatVmixTimer(272)).toBe('00:04:32');
    expect(formatVmixTimer(3723)).toBe('01:02:03');
    expect(formatVmixTimer(-5)).toBe('00:00:00');
  });

  it('derives the colour state from the seconds left', () => {
    expect(timingState(11, 10)).toBe('normal');
    expect(timingState(10, 10)).toBe('warning');
    expect(timingState(0, 10)).toBe('warning');
    expect(timingState(-1, 10)).toBe('overtime');
    expect(timingState(null, 10)).toBe('normal');
  });

  it('parses positions from a comma separated query or a repeated one', () => {
    expect(parsePositions('Presentatie, Analist')).toEqual(['Presentatie', 'Analist']);
    expect(parsePositions(['Presentatie', 'Analist,Speaker'])).toEqual(['Presentatie', 'Analist', 'Speaker']);
    expect(parsePositions(undefined)).toEqual([]);
  });
});

describe('selectCurrentAndNext', () => {
  const events = [
    event('a', 1, ['Presentatie']),
    event('b', 2, ['Camera links']),
    event('c', 3, []),
    event('d', 4, ['Analist']),
  ];

  it('skips items for other positions but keeps items without positions', () => {
    const {current, next} = selectCurrentAndNext(events, 'a', ['Presentatie']);
    expect(current?.id).toBe('a');
    expect(next?.id).toBe('c');
  });

  it('has no current item when the active item is for another position', () => {
    const {current, next} = selectCurrentAndNext(events, 'b', ['Analist']);
    expect(current).toBeNull();
    expect(next?.id).toBe('c');
  });

  it('matches position slugs and ignores case', () => {
    const {next} = selectCurrentAndNext(events, 'c', ['analist']);
    expect(next?.id).toBe('d');
  });

  it('takes the first waiting relevant item when nothing is active', () => {
    const done = [{...events[0], status: 'COMPLETED'}, ...events.slice(1)];
    const {current, next} = selectCurrentAndNext(done, null, ['Presentatie']);
    expect(current).toBeNull();
    expect(next?.id).toBe('c');
  });
});

describe('buildCallsheetTiming', () => {
  it('computes the remaining time of the current item and the start of the next one', () => {
    const timing = buildCallsheetTiming({
      productionId: 7,
      events: [
        event('a', 1, ['Presentatie'], {status: 'ACTIVE', durationSec: 300, actualStartTime: new Date(NOW.getTime() - 28_000)}),
        event('b', 2, ['Analist'], {durationSec: 120, plannedStartTime: new Date(NOW.getTime() + 272_000)}),
      ],
      activeEventId: 'a',
      positions: ['Presentatie', 'Analist'],
      warningSeconds: 10,
      now: NOW,
    });

    expect(timing).toMatchObject({
      productionId: 7,
      positions: 'Presentatie, Analist',
      currentTitle: 'Item a',
      currentDuration: '05:00',
      currentDurationVmix: '00:05:00',
      currentRemaining: '04:32',
      currentRemainingSeconds: 272,
      currentTimerVmix: '00:04:32',
      currentStartTime: '19:59',
      currentState: 'normal',
      nextTitle: 'Item b',
      nextDuration: '02:00',
      nextStartsIn: '04:32',
      nextStartsInVmix: '00:04:32',
      nextStartTime: '20:04',
      nextState: 'normal',
    });
  });

  it('turns orange near the end and red over time', () => {
    const build = (elapsedSec: number) => buildCallsheetTiming({
      productionId: 7,
      events: [
        event('a', 1, [], {status: 'ACTIVE', durationSec: 60, actualStartTime: new Date(NOW.getTime() - elapsedSec * 1000)}),
        event('b', 2, [], {plannedStartTime: new Date(NOW.getTime() + (60 - elapsedSec) * 1000)}),
      ],
      activeEventId: 'a', positions: [], warningSeconds: 10, now: NOW,
    });

    expect(build(52)).toMatchObject({currentRemaining: '00:08', currentState: 'warning', nextState: 'warning'});
    expect(build(72)).toMatchObject({currentRemaining: '-00:12', currentTimerVmix: '00:00:00', currentState: 'overtime', nextStartsIn: '-00:12', nextState: 'overtime'});
  });

  it('returns empty fields without an active production', () => {
    const timing = buildCallsheetTiming({productionId: null, events: [], activeEventId: null, positions: ['Presentatie'], warningSeconds: 10, now: NOW});
    expect(timing).toMatchObject({currentTitle: '', currentRemaining: '', currentState: 'normal', nextTitle: '', nextStartsIn: '', nextState: 'normal'});
  });
});

describe('selectCurrentAndNext with the hall lane (parallel-lanes D4)', () => {
  const ev = (id: string, order: number, status: string, positions: string[]) => ({
    id, order, title: id, status, durationSec: 60, actualStartTime: null, plannedStartTime: null,
    positions: positions.map((name) => ({position: {name}})),
  });
  const events = [ev('stream', 1, 'ACTIVE', ['Regie livestream']), ev('zaal', 2, 'ACTIVE', ['Speaker']), ev('zaal2', 3, 'WAITING', ['Speaker']), ev('join', 4, 'WAITING', [])];

  it('the hall item is current for its own positions, the next one after it', () => {
    const {current, next} = selectCurrentAndNext(events, 'stream', ['Speaker'], 'zaal');
    expect(current?.id).toBe('zaal');
    expect(next?.id).toBe('zaal2');
  });

  it('the stream item stays current for the stream positions', () => {
    const {current, next} = selectCurrentAndNext(events, 'stream', ['Regie livestream'], 'zaal');
    expect(current?.id).toBe('stream');
    expect(next?.id).toBe('join');
  });
});
