import {render, screen} from '@testing-library/react';
import {CallSheetItem} from './CallSheetItem';
import {describe, expect, it, vi} from 'vitest';
import {ProductionEvent} from '../hooks/useLiveState';

// Mock FontSizeProvider context
vi.mock('../hooks/useFontSize', () => ({
    useFontSize: () => ({ fontSize: 'm' })
}));

describe('CallSheetItem', () => {
  const mockItem: ProductionEvent = {
    id: 'event-1',
    title: 'Test Event',
    durationSec: 60,
    autoAdvance: true,
    isInLivestream: true,
    isInVenue: false,
    status: 'WAITING',
    order: 1,
    productionId: 1,
    positions: []
  };

  it('should show "TIMER" badge when isAutoAdvanceScheduled is true', () => {
    render(<CallSheetItem item={mockItem} isAutoAdvanceScheduled={true} />);

    expect(screen.getByText(/TIMER/i)).toBeDefined();
    expect(screen.getByText(/Auto/i)).toBeDefined();
  });

  it('should not show "TIMER" badge when isAutoAdvanceScheduled is false', () => {
    render(<CallSheetItem item={mockItem} isAutoAdvanceScheduled={false} />);

    expect(screen.queryByText(/TIMER/i)).toBeNull();
    expect(screen.getByText(/Auto/i)).toBeDefined();
  });

  it('should show active status when isActive is true', () => {
    const { container } = render(<CallSheetItem item={mockItem} isActive={true} />);

    // Check for active ring classes
    const activeDiv = container.querySelector('.ring-2.ring-yellow-400');
    expect(activeDiv).toBeDefined();
  });
});
