import {vi} from 'vitest';
import type {ProductionEvent} from '../hooks/useLiveState';
import type {ShowControls} from '../hooks/useShowControls';

/**
 * Shared test data for the Show Caller component tests (phone and wide layout). Build what a test needs
 * from these, so a change to an item or to the actions is made here once.
 */
export const REGIE = {id: 5, name: 'Regie livestream'};
export const CAMERA = {id: 2, name: 'Camera links'};

export type TestItem = ProductionEvent & { calculatedTime: Date };

/** A callsheet item as the live state delivers it; planned one minute apart from 19:50. */
export function showItem(id: string, order: number, title: string, extra: Partial<ProductionEvent> & { positionList?: Array<{ id: number; name: string }> } = {}): TestItem {
  const {positionList = [REGIE], ...rest} = extra;
  const planned = new Date(2026, 9, 17, 19, 50 + order);
  return {
    id, order, title, note: null, durationSec: 60, status: 'WAITING', positions: positionList.map((position) => ({position})),
    isInVenue: false, isInLivestream: true, autoAdvance: false, isTimeAnchor: false, parentId: null,
    plannedStartTime: planned.toISOString(), actualStartTime: null, calculatedTime: planned,
    ...rest,
  } as unknown as TestItem;
}

/**
 * A running show: the first item done, the second on now. Items 3 and 6 are for the camera, item 5 is for
 * everyone (no positions); the others are for the regie.
 */
export const showItems: TestItem[] = [
  showItem('a', 1, 'Livestream starten', {status: 'COMPLETED'}),
  showItem('b', 2, 'Presentator heet publiek welkom', {note: 'Microfoon open', status: 'ACTIVE', autoAdvance: true}),
  showItem('c', 3, 'Shots zaal', {positionList: [CAMERA]}),
  showItem('d', 4, 'Interview {coach-uit}'),
  showItem('e', 5, 'Opkomst spelers', {positionList: []}),
  showItem('f', 6, 'Camera naar de bank', {positionList: [CAMERA]}),
];

/** For the regie: items with that position, or without positions. */
export const isForRegie = (e: ProductionEvent) => e.positions.length === 0 || e.positions.some((p) => p.position.id === REGIE.id);

export const remaining = (seconds: number) => ({
  minutes: String(Math.floor(Math.abs(seconds) / 60)).padStart(2, '0'),
  seconds: String(Math.abs(seconds) % 60).padStart(2, '0'),
  isNegative: seconds < 0,
  rawSeconds: seconds,
});

/** The Show Caller's actions, all spies; set `error` to show a failure. */
export function fakeControls(overrides: Partial<ShowControls> = {}): ShowControls {
  return {
    isProcessing: false, error: null, clearError: vi.fn(),
    start: vi.fn(), next: vi.fn(), previous: vi.fn(), recalculate: vi.fn(), reset: vi.fn(), stop: vi.fn(), setRemaining: vi.fn(),
    ...overrides,
  } as ShowControls;
}
