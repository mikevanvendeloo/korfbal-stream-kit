import {act, renderHook} from '@testing-library/react';
import {useLiveState} from './useLiveState';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {io} from 'socket.io-client'; // Mock socket.io-client

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };
  return {
    io: vi.fn(() => mSocket),
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ productionId: '123' }),
}));

// Mock FontSizeProvider context
vi.mock('../hooks/useFontSize', () => ({
    useFontSize: () => ({ fontSize: 'm' })
}));

describe('useLiveState WebSocket events', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = (io as any)();
    // Mock fetch to prevent errors
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], activeEvent: null }),
    });
  });

  it('should update autoAdvanceEventId when auto_advance_scheduled is received', async () => {
    const { result } = renderHook(() => useLiveState());

    // Find the 'auto_advance_scheduled' handler
    const handler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'auto_advance_scheduled')[1];
    expect(handler).toBeDefined();

    // Trigger the handler
    const mockData = { eventId: 'event-1', delayMs: 1000 };
    await act(async () => {
      handler(mockData);
    });

    // Verify state update
    expect(result.current.autoAdvanceEventId).toBe('event-1');
  });

  it('removes its own handlers on unmount but keeps the shared socket connected', () => {
    const { unmount } = renderHook(() => useLiveState());
    const handler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'active_event_update')[1];

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('active_event_update', handler);
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
  });

  it('should reset autoAdvanceEventId when active_event_update is received', async () => {
    const { result } = renderHook(() => useLiveState());

    // 1. Set an initial autoAdvanceEventId
    const autoHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'auto_advance_scheduled')[1];
    await act(async () => {
      autoHandler({ eventId: 'event-1', delayMs: 1000 });
    });
    expect(result.current.autoAdvanceEventId).toBe('event-1');

    // 2. Trigger active_event_update
    const activeHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'active_event_update')[1];
    await act(async () => {
        activeHandler({ id: 'event-2', title: 'New Event' });
    });

    // 3. Verify it is reset
    expect(result.current.autoAdvanceEventId).toBeNull();
  });
});

describe('useLiveState venue clock', () => {
  let mockSocket: any;
  const handlerOf = (event: string) => mockSocket.on.mock.calls.filter((call: any) => call[0] === event).at(-1)[1];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSocket = (io as any)();
    global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({items: []})});
  });
  afterEach(() => vi.useRealTimers());

  it('shows the scoreboard time as it is and never counts on itself, so a stopped clock stands still', async () => {
    const {result} = renderHook(() => useLiveState());
    // A running production clock: before the fix the venue clock was counted down along with it
    await act(async () => handlerOf('time_state_update')({mode: 'counting_up', serverStartTime: Date.now(), initialDuration: 0, venueClock: '00:00'}));
    await act(async () => handlerOf('venue_clock_update')({scoreboardTime: 15 * 60 + 34}));
    expect(result.current.venueClock).toBe('15:34');

    // The clock stands still (stoppage): no new time comes in, the display must not move
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(result.current.venueClock).toBe('15:34');

    await act(async () => handlerOf('venue_clock_update')({scoreboardTime: 15 * 60 + 33}));
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(result.current.venueClock).toBe('15:33');
  });

  it('keeps the production clock and the venue clock apart', async () => {
    const {result} = renderHook(() => useLiveState());
    await act(async () => handlerOf('time_state_update')({mode: 'counting_up', serverStartTime: Date.now() - 10_000, initialDuration: 0, venueClock: '00:00'}));
    await act(async () => handlerOf('venue_clock_update')({scoreboardTime: 15 * 60 + 34}));
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(`${result.current.productionClock.minutes}:${result.current.productionClock.seconds}`).toBe('00:10');

    // A production clock update does not touch the venue clock
    await act(async () => handlerOf('time_state_update')({mode: 'stopped', serverStartTime: 0, initialDuration: 0, venueClock: '00:00'}));
    expect(result.current.venueClock).toBe('15:34');
  });

  it('takes the venue clock from the live state snapshot too, also at 00:00', async () => {
    const {result} = renderHook(() => useLiveState());
    await act(async () => handlerOf('callsheet_state_update')({clocks: {scoreboardTime: 65, productionTime: 0}, isClockRunning: false}));
    expect(result.current.venueClock).toBe('01:05');
    await act(async () => handlerOf('callsheet_state_update')({clocks: {scoreboardTime: 0, productionTime: 0}, isClockRunning: false}));
    expect(result.current.venueClock).toBe('00:00');
  });
});
