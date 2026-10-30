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
    start: vi.fn(), next: vi.fn(), previous: vi.fn(), recalculate: vi.fn(), reset: vi.fn(), stop: vi.fn(), setRemaining: vi.fn(), venueNext: vi.fn(),
    ...overrides,
  } as ShowControls;
}

/** For the LED wall in the hall */
export const LED = {id: 7, name: 'LED-scherm'};

/**
 * The rust with two lanes (openspec/changes/parallel-lanes): after the speaker (both, a samenkomstpunt) the
 * hall plays the LED commercial and the statistics while the stream has the commentators and the analysis;
 * both join at Start tweede helft. As set up: the LED commercial runs in the hall, the commentators on the
 * stream. Hoofdstuk Rust lasts at least 10 minutes.
 */
export const rustItems: TestItem[] = [
  showItem('r1', 1, 'Speaker kondigt rust aan', {isInVenue: true, isInLivestream: true, status: 'COMPLETED', chapterId: 2, positionList: [REGIE, LED]}),
  showItem('r2', 2, 'Reclame LED', {isInVenue: true, isInLivestream: false, status: 'ACTIVE', chapterId: 2, durationSec: 120, positionList: [LED]}),
  showItem('r3', 3, 'Commentatoren', {status: 'ACTIVE', chapterId: 2, durationSec: 120}),
  showItem('r4', 4, 'Statistieken', {isInVenue: true, isInLivestream: false, chapterId: 2, durationSec: 60, positionList: [LED]}),
  showItem('r5', 5, 'Analyse eerste helft', {chapterId: 2, durationSec: 240}),
  showItem('r6', 6, 'Start tweede helft', {isInVenue: true, isInLivestream: true, chapterId: 3, positionList: [REGIE, LED]}),
];

export const rustChapters = [{id: 2, name: 'Rust', order: 2, minDurationSec: 600}, {id: 3, name: 'Tweede helft', order: 3, minDurationSec: null}];

/** The rust later on: both hall items over, the stream at the analysis */
export const rustHallDone: TestItem[] = rustItems.map((e) =>
  e.id === 'r2' || e.id === 'r4' ? {...e, status: 'COMPLETED'} : e.id === 'r3' ? {...e, status: 'COMPLETED'} : e.id === 'r5' ? {...e, status: 'ACTIVE'} : e) as TestItem[];
