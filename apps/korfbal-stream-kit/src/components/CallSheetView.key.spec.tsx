import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render} from '@testing-library/react';
import {CallSheetView} from './CallSheetView';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import * as useLiveStateHook from '../hooks/useLiveState';

vi.mock('../hooks/useLiveState', () => ({
  useLiveState: vi.fn(),
  calculateEventTimes: vi.fn((items) => items),
}));

vi.mock('./MatchHeader', () => ({
  MatchHeader: () => <div data-testid="match-header" />
}));

vi.mock('./TimeDisplay', () => ({
  TimeDisplay: () => <div data-testid="time-display" />
}));

vi.mock('./ShowControl', () => ({
  ShowControl: () => <div data-testid="show-control" />
}));

vi.mock('./CallSheetColumn', () => ({
  CallSheetColumn: () => <div data-testid="callsheet-column" />
}));

// Mock fetch
global.fetch = vi.fn();

describe('CallSheetView Keyboard Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLiveStateHook.useLiveState as any).mockReturnValue({
      allItems: [],
      allPositions: [{ id: 1, name: 'Regie' }],
      isConnected: true,
      timeSinceLastSync: 0,
      activeEvent: null,
      productionClock: 0,
      venueClock: '00:00',
      systemTime: new Date(),
      activeEventElapsedTime: 0,
      activeEventRemainingTime: 0,
      isLoading: false,
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('triggers "next" on ArrowRight key press', async () => {
    render(
      <MemoryRouter initialEntries={['/live/1/view/regie']}>
        <Routes>
          <Route path="/live/:productionId/view/:positionSlug" element={<CallSheetView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(global.fetch).toHaveBeenCalledWith('/api/show/next', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('triggers "previous" on ArrowLeft key press', async () => {
    render(
      <MemoryRouter initialEntries={['/live/1/view/regie']}>
        <Routes>
          <Route path="/live/:productionId/view/:positionSlug" element={<CallSheetView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(global.fetch).toHaveBeenCalledWith('/api/show/previous', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('does NOT trigger API call when focus is in an input field', async () => {
    render(
      <MemoryRouter initialEntries={['/live/1/view/regie']}>
        <Routes>
          <Route path="/live/:productionId/view/:positionSlug" element={
            <>
              <CallSheetView />
              <input data-testid="test-input" />
            </>
          } />
        </Routes>
      </MemoryRouter>
    );

    const input = document.querySelector('input')!;
    fireEvent.keyDown(input, { key: 'ArrowRight' });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
