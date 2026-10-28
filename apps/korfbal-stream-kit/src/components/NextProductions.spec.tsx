import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import NextProductions, {nextProductions} from './NextProductions';
import type {Production} from '../hooks/useProductions';

// Wednesday 11 Nov 2026, 10:00 in Amsterdam (UTC+1)
const NOW = new Date('2026-11-11T09:00:00.000Z');
const production = (id: number, home: string, date: string, extra: Partial<Production> = {}): Production =>
  ({id, matchScheduleId: id, isActive: false, matchSchedule: {id, homeTeamName: home, awayTeamName: 'Opp', date}, ...extra});

const YESTERDAY = production(1, 'Fortuna 1', '2026-11-10T18:30:00.000Z');
const SATURDAY_EVENING = production(2, 'Fortuna 2', '2026-11-14T18:30:00.000Z', {isActive: true, liveTime: '2026-11-14T18:15:00.000Z'});
const SATURDAY_AFTERNOON = production(3, 'Fortuna 3', '2026-11-14T13:00:00.000Z');
// 23:30 UTC on Friday is already Saturday in Amsterdam
const SATURDAY_JUST_AFTER_MIDNIGHT = production(4, 'Fortuna 4', '2026-11-13T23:30:00.000Z');
const NEXT_WEEK = production(5, 'Fortuna 5', '2026-11-21T18:30:00.000Z');
const TODAY_THIS_MORNING = production(6, 'Fortuna 6', '2026-11-11T08:00:00.000Z');

function renderWith(items: Production[]) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({items, total: items.length})));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><NextProductions/></MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NextProductions', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the productions of the first day with productions, earliest first', () => {
    const next = nextProductions([YESTERDAY, NEXT_WEEK, SATURDAY_EVENING, SATURDAY_AFTERNOON, SATURDAY_JUST_AFTER_MIDNIGHT], NOW);
    expect(next.map((p) => p.id)).toEqual([4, 3, 2]);
  });

  it('keeps today\'s productions, also the ones that already started', () => {
    expect(nextProductions([SATURDAY_EVENING, TODAY_THIS_MORNING], NOW).map((p) => p.id)).toEqual([6]);
  });

  it('shows a card per production of that day, with the day in the heading', async () => {
    renderWith([YESTERDAY, SATURDAY_EVENING, SATURDAY_AFTERNOON, NEXT_WEEK]);
    const link = await screen.findByRole('link', {name: /Fortuna 2 – Opp/});
    expect(link.getAttribute('href')).toBe('/admin/producties/2');
    expect(screen.getByRole('heading', {name: /Eerstvolgende producties — zaterdag 14 november/})).toBeTruthy();
    expect(screen.getByText('19:15')).toBeTruthy();
    expect(screen.getByText('Actief')).toBeTruthy();
    expect(screen.getByRole('link', {name: /Fortuna 3 – Opp/})).toBeTruthy();
    expect(screen.queryByText(/Fortuna 1|Fortuna 5/)).toBeNull();
  });

  it('says "vandaag" for today', async () => {
    renderWith([TODAY_THIS_MORNING]);
    expect(await screen.findByRole('heading', {name: 'Eerstvolgende producties — vandaag'})).toBeTruthy();
  });

  it('says so when nothing is planned any more', async () => {
    renderWith([YESTERDAY]);
    expect(await screen.findByText(/Er staan geen producties meer gepland/)).toBeTruthy();
    expect(screen.getByRole('link', {name: 'Alle producties'}).getAttribute('href')).toBe('/admin/producties');
  });
});
