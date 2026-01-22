import {render, screen, waitFor} from '@testing-library/react';
import {BrowserRouter} from 'react-router-dom';
import ScoreboardPage from './ScoreboardPage';

// Mock react-query powered hooks used by ScoreboardPage to avoid needing a QueryClientProvider
vi.mock('../hooks/useProductions', () => ({
  useProductions: () => ({ data: { items: [] } }),
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
});
