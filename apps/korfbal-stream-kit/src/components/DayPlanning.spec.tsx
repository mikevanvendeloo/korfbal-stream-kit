import {describe, expect, it} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import DayPlanning, {dayPlanningEntries} from './DayPlanning';
import type {DailyOccupancyReport} from '../hooks/useReports';

type Production = DailyOccupancyReport['productions'][number];

// Saturday 12 December 2026, Amsterdam = UTC+1: streams at 15:15 and 19:15
const production = (id: number, homeTeam: string, planning: Production['planning']): Production =>
  ({id, time: planning.liveStart, homeTeam, awayTeam: 'Uit', planning});

const AFTERNOON = production(1, 'Fortuna 2', {
  setupTime: '2026-12-12T11:45:00.000Z', setupIsDefault: true, crewCallTime: '2026-12-12T13:45:00.000Z', crewCallIsDefault: true,
  liveStart: '2026-12-12T14:15:00.000Z', liveEnd: '2026-12-12T15:55:00.000Z',
});
const EVENING = production(2, 'Fortuna 1', {
  setupTime: null, setupIsDefault: false, crewCallTime: '2026-12-12T17:45:00.000Z', crewCallIsDefault: true,
  liveStart: '2026-12-12T18:15:00.000Z', liveEnd: '2026-12-12T20:05:00.000Z',
});

describe('DayPlanning', () => {
  it('lists opbouw once, then verzamelen and live per stream, in time order', () => {
    expect(dayPlanningEntries([EVENING, AFTERNOON]).map((e) => `${e.label} ${e.match ?? ''}`.trim())).toEqual([
      'Opbouw', 'Verzamelen Fortuna 2 – Uit', 'Live Fortuna 2 – Uit', 'Verzamelen Fortuna 1 – Uit', 'Live Fortuna 1 – Uit',
    ]);
  });

  it('shows the times in Amsterdam time, with the end of each stream', () => {
    render(<DayPlanning productions={[AFTERNOON, EVENING]}/>);
    const rows = within(screen.getByRole('table')).getAllByRole('row').map((row) => row.textContent);
    expect(rows).toEqual([
      '12:45Opbouw',
      '14:45VerzamelenFortuna 2 – Uit',
      '15:15LiveFortuna 2 – Uittot 16:55',
      '18:45VerzamelenFortuna 1 – Uit',
      '19:15LiveFortuna 1 – Uittot 21:05',
    ]);
  });

  it('shows nothing without productions', () => {
    const {container} = render(<DayPlanning productions={[]}/>);
    expect(container.textContent).toBe('');
  });
});
