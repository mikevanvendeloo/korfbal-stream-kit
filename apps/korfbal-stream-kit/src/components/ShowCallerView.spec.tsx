import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ShowCallerView} from './ShowCallerView';
import {useMediaQuery} from '../hooks/useMediaQuery';
import {useWakeLock} from '../hooks/useWakeLock';
import {fakeControls, REGIE, remaining, rustChapters, rustHallDone, rustItems, showItem} from '../test/showCaller';
import {StaticInterviewNames} from './InterviewText';
import {interviewNames} from '../test/interviews';

const controls = fakeControls();
const regie = REGIE;
const items = [
  showItem('a', 1, 'Livestream starten', {status: 'COMPLETED'}),
  showItem('b', 2, 'Welkom', {status: 'ACTIVE'}),
  showItem('c', 3, 'Opkomst spelers'),
];
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
      activeEventRemainingTime: remaining(50),
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

  it('shows interview photos only at the current and the next item in the wide layout', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    const withInterviews = [
      showItem('a', 1, 'Interview {coach-uit}', {status: 'COMPLETED'}),
      showItem('b', 2, 'Interview {speler-thuis}', {status: 'ACTIVE'}),
      showItem('c', 3, 'Interview {speler-uit}'),
      showItem('d', 4, 'Nog een interview {coach-uit}'),
    ];
    live = {...live, allItems: withInterviews, activeEvent: withInterviews[1]};
    render(
      <StaticInterviewNames names={interviewNames}>
        <MemoryRouter initialEntries={['/show-caller/47/regie-livestream']}>
          <Routes><Route path="/show-caller/:productionId/:positionSlug" element={<ShowCallerView/>}/></Routes>
        </MemoryRouter>
      </StaticInterviewNames>
    );
    const people = screen.getAllByTestId('interview-person').map((p) => p.textContent);
    expect(new Set(people)).toEqual(new Set(['Anna de Vries#7', '12Bram Bakker']));
    // The others keep only the name
    expect(screen.getAllByText('Nog een interview Kees Coach').length).toBeGreaterThan(0);
    // The switch is in the gear menu
    fireEvent.click(screen.getByTitle('Instellingen'));
    fireEvent.click(screen.getByRole('switch', {name: /Interviewfoto's/}));
    expect(screen.queryAllByTestId('interview-person')).toEqual([]);
    fireEvent.click(screen.getByRole('switch', {name: /Interviewfoto's/}));
    expect(screen.getAllByTestId('interview-person').length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole('button', {name: /Stream Stoppen/i}));
    expect(controls.stop).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it('sets the remaining time of the current item with Zet 15s / 30s / 60s', () => {
    renderView();
    const presets = screen.getByRole('group', {name: 'Resterend instellen'});
    expect(presets.textContent).toBe('Zet15s30s60s');
    fireEvent.click(screen.getByRole('button', {name: 'Resterend 60 seconden'}));
    expect(controls.setRemaining).toHaveBeenCalledWith(60);
  });

  it('stops the show with the red button, after confirming', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderView();
    fireEvent.click(screen.getByRole('button', {name: 'Einde show'}));
    expect(controls.stop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Einde show'}));
    expect(controls.stop).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it('asks before restarting a running show, but starts a new one right away', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const {unmount} = renderView();
    fireEvent.click(screen.getByTitle('Herstart Show'));
    expect(confirm).toHaveBeenCalledOnce();
    expect(controls.start).not.toHaveBeenCalled();
    unmount();

    live = {...live, activeEvent: null, activeEventRemainingTime: null};
    renderView();
    fireEvent.click(screen.getByTitle('Start Show'));
    expect(controls.start).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    // Nothing to stop or shorten before the start
    expect(screen.queryByRole('button', {name: 'Einde show'})).toBeNull();
    expect((screen.getByRole('button', {name: 'Resterend 30 seconden'}) as HTMLButtonElement).disabled).toBe(true);
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

describe('ShowCallerView hoofdstukken', () => {
  const chapters = [{id: 1, name: 'Voorbeschouwing', order: 1}, {id: 2, name: 'Eerste helft', order: 2}];

  beforeEach(() => {
    controls.error = null;
    Element.prototype.scrollIntoView = vi.fn();
    const inChapters = items.map((e, i) => ({...e, chapterId: i < 2 ? 1 : 2}));
    live = {
      allItems: inChapters, allPositions: [regie], chapters, activeEvent: inChapters[1], activeEventElapsedTime: 10,
      productionClock: {minutes: '05', seconds: '00', isNegative: false, rawSeconds: 300}, venueClock: '00:00', systemTime: '19:52:10',
      activeEventRemainingTime: remaining(50),
      isLoading: false, autoAdvanceEventId: null, isConnected: true, timeSinceLastSync: 1,
    };
  });

  it('shows a heading per hoofdstuk and the current one with its remaining time in the wide layout', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    renderView();
    expect(screen.getAllByRole('heading', {level: 2}).map((h) => h.textContent?.replace(/\d\d:\d\d – \d\d:\d\d/, '').trim()))
      .toEqual(expect.arrayContaining(['Voorbeschouwing', 'Eerste helft']));
    expect(screen.getByLabelText('Lopend hoofdstuk').textContent).toBe('Hoofdstuk: Voorbeschouwing· nog 0:50');
  });

  it('shows the hoofdstuk above Nu on a phone, and at Volgende when it changes', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderView();
    expect(screen.getByLabelText('Hoofdstuk').textContent).toBe('Voorbeschouwingnog 0:50');
    expect(screen.getByLabelText('Hoofdstuk van volgende').textContent).toBe('Eerste helft');
  });
});

describe('ShowCallerView: Zaal and Stream in parallel (wide)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMediaQuery).mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
    controls.error = null;
    live = {
      allItems: rustItems, allPositions: [regie], chapters: rustChapters, activeEvent: rustItems[2], activeEventElapsedTime: 30,
      productionClock: {minutes: '05', seconds: '00', isNegative: false, rawSeconds: 300}, venueClock: '00:00', systemTime: '20:00:00',
      activeEventRemainingTime: remaining(90), activeVenueEventId: 'r2', activeVenueRemainingTime: remaining(75),
      isLoading: false, autoAdvanceEventId: null, isConnected: true, timeSinceLastSync: 1,
    };
  });

  it('shows the running hall item in the Zaal lane and moves it on with Zaal ›', () => {
    renderView();
    const hall = screen.getByLabelText('Zaal');
    expect(hall.textContent).toContain('Reclame LED');
    expect(hall.textContent).toContain('nog 1:15');
    fireEvent.click(screen.getByRole('button', {name: 'Zaal ›'}));
    expect(controls.venueNext).toHaveBeenCalledOnce();
    // Every item of the rust once, side by side
    expect(screen.getAllByText('Statistieken')).toHaveLength(1);
    expect(screen.getAllByText('Analyse eerste helft')).toHaveLength(1);
  });

  it('warns that Volgend ends the hall item at the samenkomstpunt', () => {
    const items = rustItems.map((e) => (e.id === 'r2' || e.id === 'r3' ? {...e, status: 'COMPLETED'} : e.id === 'r5' ? {...e, status: 'ACTIVE'} : e));
    live = {...live, allItems: items, activeEvent: items[4], activeVenueEventId: 'r4', activeVenueRemainingTime: remaining(42)};
    renderView();
    expect(screen.getByRole('note').textContent).toBe('Volgend: Zaal nog 0:42 bezig');
  });

  it('shows the wait row in the hall lane when it is done before the stream', () => {
    live = {...live, allItems: rustHallDone, activeEvent: rustHallDone[4], activeVenueEventId: null, activeVenueRemainingTime: null};
    renderView();
    expect(screen.getByRole('status').textContent).toBe('Zaal klaar · volgende: Start tweede helft');
    expect(screen.queryByRole('button', {name: 'Zaal ›'})).toBeNull();
  });
});
