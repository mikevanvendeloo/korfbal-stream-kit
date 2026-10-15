import {fireEvent, render, renderHook, screen, waitFor, within, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ShowCallerPhone, ShowCallerPhoneProps} from './ShowCallerPhone';
import {useShowControls} from '../hooks/useShowControls';
import type {ProductionEvent} from '../hooks/useLiveState';

const at = (hh: number, mm: number) => new Date(2026, 9, 17, hh, mm);
const regie = {id: 5, name: 'Regie livestream'};
const camera = {id: 2, name: 'Camera links'};

function event(id: string, order: number, title: string, positions: Array<{ id: number; name: string }>, extra: Partial<ProductionEvent> = {}) {
  return {
    id, order, title, note: null, durationSec: 60, status: 'WAITING', positions: positions.map((position) => ({position})),
    isInVenue: false, isInLivestream: true, autoAdvance: false, isTimeAnchor: false, parentId: null,
    calculatedTime: at(19, 50 + order),
    ...extra,
  } as unknown as ProductionEvent & { calculatedTime: Date };
}

const items = [
  event('a', 1, 'Livestream starten', [regie], {status: 'COMPLETED'}),
  event('b', 2, 'Presentator heet publiek welkom', [regie], {note: 'Microfoon open', status: 'ACTIVE', autoAdvance: true}),
  event('c', 3, 'Shots zaal', [camera]),
  event('d', 4, 'Interview {coach-uit}', [regie]),
  event('e', 5, 'Opkomst spelers', []),
  event('f', 6, 'Camera naar de bank', [camera]),
];

const controls = () => ({
  isProcessing: false, error: null as string | null, clearError: vi.fn(),
  start: vi.fn(), next: vi.fn(), previous: vi.fn(), recalculate: vi.fn(), reset: vi.fn(), stop: vi.fn(),
});

function renderPhone(overrides: Partial<ShowCallerPhoneProps> = {}) {
  const props: ShowCallerPhoneProps = {
    productionId: '47', positionSlug: 'regie-livestream', positionName: 'Regie livestream', items,
    activeEventId: 'b', remaining: {minutes: '00', seconds: '08', isNegative: false, rawSeconds: 8},
    autoAdvanceEventId: null, isConnected: true, systemTime: '19:52:10',
    isRelevant: (e) => e.positions.length === 0 || e.positions.some((p) => p.position.id === regie.id),
    controls: controls(),
    ...overrides,
  };
  render(<MemoryRouter><ShowCallerPhone {...props}/></MemoryRouter>);
  return props;
}

describe('ShowCallerPhone', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows now, next and later for the chosen position', () => {
    renderPhone();
    const now = screen.getByRole('region', {name: 'Nu'});
    expect(within(now).getByText('Presentator heet publiek welkom')).toBeTruthy();
    expect(within(now).getByText('Microfoon open')).toBeTruthy();
    expect(within(now).getByLabelText('Resterend').textContent).toBe('00:08');
    // Orange in the last 10 seconds
    expect(within(now).getByLabelText('Resterend').parentElement?.className).toContain('bg-orange-500');

    // Next is what the Next button activates, also when it is for another position
    const next = screen.getByRole('region', {name: 'Volgende'});
    expect(within(next).getByText('Shots zaal')).toBeTruthy();
    expect(within(next).getByText('niet voor jouw positie')).toBeTruthy();

    // Later: only this position's items (and items for everyone)
    const later = screen.getByRole('region', {name: 'Daarna'});
    expect(within(later).getByText('Daarna voor jou')).toBeTruthy();
    expect(within(later).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Interview'), expect.stringContaining('Opkomst spelers'),
    ]);
  });

  it('puts Previous and Next at the bottom, and starts the show when nothing is on', () => {
    const props = renderPhone();
    const bar = screen.getByRole('navigation', {name: 'Show bediening'});
    fireEvent.click(within(bar).getByRole('button', {name: 'Volgend item'}));
    fireEvent.click(within(bar).getByRole('button', {name: 'Vorig item'}));
    expect(props.controls.next).toHaveBeenCalledOnce();
    expect(props.controls.previous).toHaveBeenCalledOnce();
  });

  it('offers Start show before the show begins, with the first item as next', () => {
    const props = renderPhone({activeEventId: null, remaining: null, items: items.map((e) => ({...e, status: 'WAITING'})) as never});
    expect(within(screen.getByRole('region', {name: 'Nu'})).getByText('De show is nog niet gestart')).toBeTruthy();
    expect(within(screen.getByRole('region', {name: 'Volgende'})).getByText('Livestream starten')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Start show'}));
    expect(props.controls.start).toHaveBeenCalledOnce();
  });

  it('asks before restarting the show', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const props = renderPhone();
    fireEvent.click(screen.getByRole('button', {name: 'Show Caller menu'}));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Herstart show'}));
    expect(props.controls.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Show Caller menu'}));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Herstart show'}));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(props.controls.start).toHaveBeenCalledOnce();
  });

  it('can show every later item instead of only this position', () => {
    renderPhone();
    fireEvent.click(screen.getByRole('button', {name: 'Show Caller menu'}));
    fireEvent.click(screen.getByRole('menuitemcheckbox'));
    const later = screen.getByRole('region', {name: 'Daarna'});
    expect(within(later).getAllByRole('listitem')).toHaveLength(3);
    expect(within(later).getByText('Camera naar de bank')).toBeTruthy();
    expect(within(later).queryByText('Daarna voor jou')).toBeNull();
  });

  it('shows a failed action instead of failing silently', () => {
    renderPhone({controls: {...controls(), error: 'Dit is het laatste item.'}});
    expect(screen.getByRole('alert').textContent).toBe('Dit is het laatste item.');
  });
});

describe('useShowControls', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns server errors into a message on screen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({error: 'End of show reached.'}), {status: 400})));
    const {result} = renderHook(() => useShowControls('47'));
    await act(() => result.current.next());
    await waitFor(() => expect(result.current.error).toBe('Dit is het laatste item.'));
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
