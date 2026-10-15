import {fireEvent, render, renderHook, screen, waitFor, within, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ShowCallerPhone, ShowCallerPhoneProps} from './ShowCallerPhone';
import {useShowControls} from '../hooks/useShowControls';
import {fakeControls, isForRegie, remaining, showItems} from '../test/showCaller';

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
    fireEvent.click(screen.getByRole('menuitemcheckbox'));
    const later = screen.getByRole('region', {name: 'Daarna'});
    expect(within(later).getAllByRole('listitem')).toHaveLength(3);
    expect(within(later).getByText('Camera naar de bank')).toBeTruthy();
    expect(within(later).queryByText('Daarna voor jou')).toBeNull();
  });

  it('shows a failed action instead of failing silently', () => {
    renderPhone({controls: fakeControls({error: 'Dit is het laatste item.'})});
    expect(screen.getByRole('alert').textContent).toBe('Dit is het laatste item.');
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
