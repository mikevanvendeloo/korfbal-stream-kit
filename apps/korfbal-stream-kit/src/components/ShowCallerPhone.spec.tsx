import {fireEvent, render, renderHook, screen, waitFor, within, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ShowCallerPhone, ShowCallerPhoneProps} from './ShowCallerPhone';
import {useShowControls} from '../hooks/useShowControls';
import {fakeControls, isForRegie, remaining, rustChapters, rustHallDone, rustItems, showItem, showItems} from '../test/showCaller';
import {StaticInterviewNames} from './InterviewText';
import {interviewNames} from '../test/interviews';
import {INTERVIEW_PHOTOS_STORAGE_KEY, resetInterviewPhotosForTests} from '../hooks/useInterviewPhotos';

const items = showItems;

function renderPhone(overrides: Partial<ShowCallerPhoneProps> = {}) {
  const props: ShowCallerPhoneProps = {
    productionId: '47', positionSlug: 'regie-livestream', positionName: 'Regie livestream', items,
    activeEventId: 'b', remaining: remaining(8),
    autoAdvanceEventId: null, isConnected: true, systemTime: '19:52:10',
    isRelevant: isForRegie,
    controls: fakeControls(),
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

  it('sets the remaining time of the current item in one press', () => {
    const props = renderPhone();
    const presets = within(screen.getByRole('region', {name: 'Nu'})).getByRole('group', {name: 'Resterend instellen'});
    expect(within(presets).getAllByRole('button').map((b) => b.textContent)).toEqual(['15s', '30s', '60s']);
    fireEvent.click(within(presets).getByRole('button', {name: 'Resterend 30 seconden'}));
    expect(props.controls.setRemaining).toHaveBeenCalledWith(30);
  });

  it('stops the show from the bottom bar, after confirming', () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const props = renderPhone();
    const stop = within(screen.getByRole('navigation', {name: 'Show bediening'})).getByRole('button', {name: 'Einde show'});
    fireEvent.click(stop);
    expect(props.controls.stop).not.toHaveBeenCalled();
    fireEvent.click(stop);
    expect(props.controls.stop).toHaveBeenCalledOnce();
  });

  it('offers Start show before the show begins, with the first item as next', () => {
    const props = renderPhone({activeEventId: null, remaining: null, items: items.map((e) => ({...e, status: 'WAITING'})) as never});
    expect(within(screen.getByRole('region', {name: 'Nu'})).getByText('De show is nog niet gestart')).toBeTruthy();
    expect(within(screen.getByRole('region', {name: 'Volgende'})).getByText('Livestream starten')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Start show'}));
    expect(props.controls.start).toHaveBeenCalledOnce();
    // Nothing to stop or shorten before the start
    expect(screen.queryByRole('button', {name: 'Einde show'})).toBeNull();
    expect(screen.queryByRole('group', {name: 'Resterend instellen'})).toBeNull();
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
    fireEvent.click(screen.getByRole('menuitemcheckbox', {name: /Daarna/}));
    const later = screen.getByRole('region', {name: 'Daarna'});
    expect(within(later).getAllByRole('listitem')).toHaveLength(3);
    expect(within(later).getByText('Camera naar de bank')).toBeTruthy();
    expect(within(later).queryByText('Daarna voor jou')).toBeNull();
  });

  it('shows a failed action instead of failing silently', () => {
    renderPhone({controls: fakeControls({error: 'Dit is het laatste item.'})});
    expect(screen.getByRole('alert').textContent).toBe('Dit is het laatste item.');
  });

  it('shows interview photos at now and next only, and the menu switches them off', () => {
    window.localStorage.removeItem(INTERVIEW_PHOTOS_STORAGE_KEY);
    resetInterviewPhotosForTests();
    const withInterviews = [
      showItem('n', 1, 'Interview {speler-thuis}', {status: 'ACTIVE'}),
      showItem('v', 2, 'Interview {coach-uit}'),
      showItem('l', 3, 'Interview {speler-uit}'),
    ];
    render(
      <StaticInterviewNames names={interviewNames}>
        <MemoryRouter>
          <ShowCallerPhone productionId="47" positionSlug="all" positionName={null} items={withInterviews} activeEventId="n"
                           remaining={remaining(30)} autoAdvanceEventId={null} isConnected systemTime="19:52:10"
                           isRelevant={() => true} controls={fakeControls()}/>
        </MemoryRouter>
      </StaticInterviewNames>
    );
    expect(within(screen.getByRole('region', {name: 'Nu'})).getByRole('img', {name: 'Foto van Anna de Vries'})).toBeTruthy();
    expect(within(screen.getByRole('region', {name: 'Volgende'})).getByRole('img', {name: 'Kees Coach'})).toBeTruthy();
    // Later items: the name only
    const later = screen.getByRole('region', {name: 'Daarna'});
    expect(within(later).getByText('Interview Bram Bakker')).toBeTruthy();
    expect(within(later).queryByRole('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: 'Show Caller menu'}));
    fireEvent.click(screen.getByRole('menuitemcheckbox', {name: /Interviewfoto's: aan/}));
    expect(screen.queryAllByTestId('interview-person')).toEqual([]);
    expect(within(screen.getByRole('region', {name: 'Nu'})).getByText('Interview Anna de Vries')).toBeTruthy();
    expect(window.localStorage.getItem(INTERVIEW_PHOTOS_STORAGE_KEY)).toBe('off');
  });
});

describe('useShowControls', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the remaining seconds to the server', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const {result} = renderHook(() => useShowControls('47'));
    await act(() => result.current.setRemaining(15));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain('/api/show/remaining');
    expect(JSON.parse(String(init.body))).toEqual({seconds: 15});
  });

  it('sends each action to its own address on the server', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const {result} = renderHook(() => useShowControls('47'));
    for (const action of ['start', 'next', 'previous', 'recalculate', 'reset', 'stop'] as const) {
      await act(() => result.current[action]());
    }
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/show/start/47', '/api/show/next', '/api/show/previous', '/api/show/recalculate/47', '/api/show/reset/47', '/api/show/stop/47',
    ]);
    expect(result.current.error).toBeNull();
  });

  it('sends one request when tapped twice quickly', async () => {
    let finish: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const {result} = renderHook(() => useShowControls('47'));
    let first: Promise<void> = Promise.resolve();
    act(() => { first = result.current.next(); });
    await act(() => result.current.next());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isProcessing).toBe(true));
    await act(async () => { finish(new Response('{}')); await first; });
    expect(result.current.isProcessing).toBe(false);
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const {result} = renderHook(() => useShowControls('47'));
    await act(() => result.current.next());
    expect(result.current.error).toBe('Geen verbinding met de server.');
  });

  it('turns server errors into a message on screen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({error: 'End of show reached.'}), {status: 400})));
    const {result} = renderHook(() => useShowControls('47'));
    await act(() => result.current.next());
    await waitFor(() => expect(result.current.error).toBe('Dit is het laatste item.'));
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});

describe('ShowCallerPhone: Zaal and Stream in parallel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the hall item with its countdown next to the stream, and Zaal › moves it on', () => {
    const props = renderPhone({items: rustItems, activeEventId: 'r3', activeVenueEventId: 'r2', venueRemaining: remaining(75), remaining: remaining(90), chapters: rustChapters});
    const hall = screen.getByRole('region', {name: 'Zaal'});
    expect(hall.textContent).toContain('Reclame LED');
    expect(within(hall).getByLabelText('Zaal resterend').textContent).toBe('01:15');
    fireEvent.click(within(hall).getByRole('button', {name: 'Zaal ›'}));
    expect(props.controls.venueNext).toHaveBeenCalledOnce();
    // Volgend follows the stream: the statistics run by themselves in the hall
    expect(screen.getByRole('region', {name: 'Volgende'}).textContent).toContain('Analyse eerste helft');
    expect(within(screen.getByRole('navigation', {name: 'Show bediening'})).queryByRole('note')).toBeNull();
  });

  it('warns on Volgend when the next step is a samenkomstpunt while the hall still runs', () => {
    const items = rustItems.map((e) => (e.id === 'r2' || e.id === 'r3' ? {...e, status: 'COMPLETED'} : e.id === 'r5' ? {...e, status: 'ACTIVE'} : e));
    renderPhone({items: items as never, activeEventId: 'r5', activeVenueEventId: 'r4', venueRemaining: remaining(42)});
    expect(screen.getByRole('region', {name: 'Volgende'}).textContent).toContain('Start tweede helft');
    const volgend = within(screen.getByRole('navigation', {name: 'Show bediening'})).getByRole('button', {name: 'Volgend item'});
    expect(within(volgend).getByRole('note').textContent).toBe('Zaal nog 0:42 bezig');
  });

  it('shows a wait row when the hall lane is done before the stream', () => {
    renderPhone({items: rustHallDone, activeEventId: 'r5', activeVenueEventId: null});
    const hall = screen.getByRole('region', {name: 'Zaal'});
    expect(hall.textContent).toContain('Zaal klaar · volgende: Start tweede helft');
    expect(within(hall).queryByRole('button', {name: 'Zaal ›'})).toBeNull();
  });

  it('shows no hall lane where Zaal and Stream don\'t run in parallel', () => {
    renderPhone();
    expect(screen.queryByRole('region', {name: 'Zaal'})).toBeNull();
  });

  it('Zaal › posts to the production\'s venue-next', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const {result} = renderHook(() => useShowControls('47'));
    await act(() => result.current.venueNext());
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/production/47/venue-next');
    vi.unstubAllGlobals();
  });
});
