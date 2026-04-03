import {act, renderHook} from '@testing-library/react';
import {useLiveState} from './useLiveState';
import {beforeEach, describe, expect, it, vi} from 'vitest';
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
