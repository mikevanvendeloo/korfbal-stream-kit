import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ShowCallerView} from './ShowCallerView';
import {useMediaQuery} from '../hooks/useMediaQuery';
import {useWakeLock} from '../hooks/useWakeLock';

const controls = {
  isProcessing: false, error: null as string | null, clearError: vi.fn(),
  start: vi.fn(), next: vi.fn(), previous: vi.fn(), recalculate: vi.fn(), reset: vi.fn(), stop: vi.fn(), setRemaining: vi.fn(),
};
const regie = {id: 5, name: 'Regie livestream'};
const item = (id: string, order: number, title: string, status = 'WAITING') => ({
  id, order, title, status, note: null, durationSec: 60, positions: [{position: regie}], isInVenue: false, isInLivestream: true,
  autoAdvance: false, isTimeAnchor: false, parentId: null, plannedStartTime: new Date(2026, 9, 17, 19, 50 + order).toISOString(), actualStartTime: null,
});
const items = [item('a', 1, 'Livestream starten', 'COMPLETED'), item('b', 2, 'Welkom', 'ACTIVE'), item('c', 3, 'Opkomst spelers')];
let live: Record<string, unknown>;

vi.mock('../hooks/useShowControls', async (importOriginal) => ({...(await importOriginal<object>()), useShowControls: () => controls}));
vi.mock('../hooks/useMediaQuery', async (importOriginal) => ({...(await importOriginal<object>()), useMediaQuery: vi.fn(() => false)}));
vi.mock('../hooks/useWakeLock', () => ({useWakeLock: vi.fn()}));
vi.mock('./MatchHeader', () => ({MatchHeader: () => <div>Thuis - Uit</div>}));
vi.mock('../hooks/useLiveState', async (importOriginal) => ({...(await importOriginal<object>()), useLiveState: () => live}));

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/show-caller/47/regie-livestream']}>
      <Routes><Route path="/show-caller/:productionId/:positionSlug" element={<ShowCallerView/>}/></Routes>
    </MemoryRouter>
  );
}

describe('ShowCallerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom doesn't scroll; the wide layout scrolls to the active item
    Element.prototype.scrollIntoView = vi.fn();
    controls.error = null;
    live = {
      allItems: items, allPositions: [regie], activeEvent: items[1], activeEventElapsedTime: 10,
      productionClock: {minutes: '05', seconds: '00', isNegative: false, rawSeconds: 300}, venueClock: '00:00', systemTime: '19:52:10',
      activeEventRemainingTime: {minutes: '00', seconds: '50', isNegative: false, rawSeconds: 50},
      isLoading: false, autoAdvanceEventId: null, isConnected: true, timeSinceLastSync: 1,
    };
  });

  it('shows the phone layout on a small screen, and keeps the screen on', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderView();
    expect(screen.getByRole('navigation', {name: 'Show bediening'})).toBeTruthy();
    expect(screen.getByRole('region', {name: 'Nu'}).textContent).toContain('Welkom');
    expect(screen.getByRole('region', {name: 'Volgende'}).textContent).toContain('Opkomst spelers');
    expect(useWakeLock).toHaveBeenCalledWith(true);
  });

  it('shows the wide layout with both lanes on a large screen', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    renderView();
    expect(screen.queryByRole('navigation', {name: 'Show bediening'})).toBeNull();
    expect(screen.getByText(/Stream draaiboek/i)).toBeTruthy();
    expect(screen.getAllByText('Welkom').length).toBeGreaterThan(0);
  });

  it('moves the show along with the buttons and the arrow keys', () => {
    renderView();
    fireEvent.click(screen.getByTitle('Volgend item'));
    fireEvent.click(screen.getByTitle('Vorig item'));
    fireEvent.keyDown(window, {key: 'ArrowRight'});
    fireEvent.keyDown(window, {key: 'ArrowLeft'});
    expect(controls.next).toHaveBeenCalledTimes(2);
    expect(controls.previous).toHaveBeenCalledTimes(2);
  });

  it('runs the actions in the settings menu, asking first before resetting or stopping', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderView();
    const openMenu = () => fireEvent.click(screen.getByTitle('Instellingen'));

    openMenu();
    fireEvent.click(screen.getByRole('button', {name: 'Tijden herberekenen'}));
    expect(controls.recalculate).toHaveBeenCalledOnce();

    openMenu();
    fireEvent.click(screen.getByRole('button', {name: 'Draaiboek Resetten'}));
    expect(controls.reset).toHaveBeenCalledOnce();

    openMenu();
    fireEvent.click(screen.getByRole('button', {name: /Einde Show/i}));
    expect(controls.stop).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it('shows a failed action on screen', () => {
    controls.error = 'Dit is het laatste item.';
    renderView();
    fireEvent.click(screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toBe('Dit is het laatste item.');
    expect(controls.clearError).toHaveBeenCalled();
  });
});
