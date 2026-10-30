import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {BrowserRouter} from 'react-router-dom';
import ScoreboardPage from './ScoreboardPage';

// Mock react-query powered hooks used by ScoreboardPage to avoid needing a QueryClientProvider
vi.mock('../hooks/useProductions', () => ({
  useActiveProduction: () => ({ data: null }),
}));
vi.mock('../hooks/useClubs', () => ({
  useClubs: () => ({ data: [] }),
}));

// Helper to mock fetch responses by URL
function setupFetchMock() {
  const original = global.fetch as any;
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (url.includes('/scoreboard/shotclock')) {
      return {
        ok: true,
        json: async () => [{ status: 'OK', time: 9, color: 'orange' }],
      } as any;
    }
    if (url.includes('/scoreboard/clock')) {
      return {
        ok: true,
        // 7 minutes and 3 seconds
        json: async () => [{ status: 'OK', minute: '7', second: '03', period: 1 }],
      } as any;
    }
    if (url.includes('/scoreboard')) {
      return {
        ok: true,
        json: async () => [{ status: 'OK', home: 5, guest: 12 }],
      } as any;
    }
    return { ok: false, status: 404 } as any;
  });
  global.fetch = mock;
  return { restore: () => (global.fetch = original), mock };
}

describe('ScoreboardPage', () => {
  it('renders scores from API, match clock with header and period tagline, and applies shotclock color class', async () => {
    const { restore, mock } = setupFetchMock();

    render(
      <BrowserRouter>
        <ScoreboardPage />
      </BrowserRouter>
    );

    // Wait for numbers to render
    await waitFor(() => expect(screen.getByLabelText('home-score').textContent?.trim()).toBe('5'));
    expect(screen.getByLabelText('guest-score').textContent?.trim()).toBe('12');

    const shot = screen.getByLabelText('shotclock');
    expect(shot).toHaveClass('text-orange-400');
    expect(shot.textContent?.trim()).toBe('9');

    const matchClock = screen.getByLabelText('match-clock');
    expect(matchClock.textContent?.trim()).toBe('7:03');

    // Header and period tagline
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('1st half')).toBeInTheDocument();

    // Ensure our API endpoints were called
    const calledUrls = (mock.mock.calls as any[]).map((c: any[]) => c[0].toString());
    expect(calledUrls.some((u: string) => u.includes('/scoreboard'))).toBe(true);
    expect(calledUrls.some((u: string) => u.includes('/scoreboard/shotclock'))).toBe(true);
    expect(calledUrls.some((u: string) => u.includes('/scoreboard/clock'))).toBe(true);

    restore();
  });

  describe('device connection', () => {
    // down: devices whose endpoint answers 502 (as the API does when the device doesn't respond)
    function setupDevices(down: { scoreboard?: boolean; shotclock?: boolean }) {
      const original = global.fetch;
      const state = {...down};
      const answer = (ok: boolean, body: unknown) =>
        ({ok, status: ok ? 200 : 502, json: async () => body}) as unknown as Response;
      const fail = answer(false, {error: 'Failed'});
      const mock = vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/scoreboard/shotclock')) {
          return state.shotclock ? fail : answer(true, [{time: 20, color: 'green'}]);
        }
        if (url.includes('/scoreboard/clock')) {
          return state.scoreboard ? fail : answer(true, [{minute: '7', second: '03', period: 1}]);
        }
        return state.scoreboard ? fail : answer(true, [{home: 5, guest: 12}]);
      });
      global.fetch = mock;
      const callsTo = (part: string) =>
        mock.mock.calls.filter(([input]) => input.toString().includes(part)).length;
      return {restore: () => (global.fetch = original), mock, state, callsTo};
    }

    async function tick(ms: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    }

    function renderPage() {
      return render(
        <BrowserRouter>
          <ScoreboardPage />
        </BrowserRouter>
      );
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('shows UIT, -:- and - after three failed polls, stops polling and shows the status bar', async () => {
      const {restore, callsTo} = setupDevices({scoreboard: true, shotclock: true});
      renderPage();
      await tick(0);
      await tick(2000);

      expect(screen.getByLabelText('shotclock').textContent?.trim()).toBe('UIT');
      expect(screen.getByLabelText('match-clock').textContent?.trim()).toBe('-:-');
      expect(screen.getByLabelText('home-score').textContent?.trim()).toBe('-');
      expect(screen.getByLabelText('guest-score').textContent?.trim()).toBe('-');

      const bar = screen.getByRole('status', {name: 'Verbinding apparaten'});
      expect(within(bar).getByText('Scorebord')).toBeInTheDocument();
      expect(within(bar).getByText('Schotklok')).toBeInTheDocument();
      expect(within(bar).getAllByRole('button', {name: /Reconnect/})).toHaveLength(2);

      const shot = callsTo('/shotclock');
      const clock = callsTo('/scoreboard/clock');
      await tick(10_000);
      expect(callsTo('/shotclock')).toBe(shot);
      expect(callsTo('/scoreboard/clock')).toBe(clock);
      restore();
    });

    it('one failed poll does not disconnect', async () => {
      const {restore, state} = setupDevices({});
      renderPage();
      await tick(0);
      state.shotclock = true;
      await tick(500);
      state.shotclock = false;
      await tick(500);
      expect(screen.getByLabelText('shotclock').textContent?.trim()).toBe('20');
      expect(screen.queryByRole('button', {name: /Reconnect/})).toBeNull();
      expect(screen.getByRole('status', {name: 'Verbinding apparaten'}).textContent).toContain('Schotklok: verbonden');
      restore();
    });

    it('Reconnect resumes polling of that device only', async () => {
      const {restore, state, callsTo} = setupDevices({shotclock: true});
      renderPage();
      await tick(0);
      await tick(1000);
      expect(screen.getByLabelText('shotclock').textContent?.trim()).toBe('UIT');
      expect(screen.getByLabelText('home-score').textContent?.trim()).toBe('5');
      expect(screen.getAllByRole('button', {name: /Reconnect/})).toHaveLength(1);

      state.shotclock = false;
      const before = callsTo('/shotclock');
      fireEvent.click(screen.getByRole('button', {name: 'Reconnect Schotklok'}));
      await tick(0);
      expect(callsTo('/shotclock')).toBe(before + 1);
      expect(screen.getByLabelText('shotclock').textContent?.trim()).toBe('20');
      expect(screen.queryByRole('button', {name: /Reconnect/})).toBeNull();
      await tick(500);
      expect(callsTo('/shotclock')).toBe(before + 2);
      restore();
    });
  });
});
