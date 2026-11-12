import {render, screen} from '@testing-library/react';
import {CallSheetItem} from './CallSheetItem';
import {describe, expect, it, vi} from 'vitest';
import {formatSystemTime, ProductionEvent} from '../hooks/useLiveState';
import {showItem} from '../test/showCaller';

// Mock FontSizeProvider context
vi.mock('../hooks/useFontSize', () => ({
    useFontSize: () => ({ fontSize: 'm' })
}));

describe('CallSheetItem', () => {
  const mockItem: ProductionEvent = showItem('event-1', 1, 'Test Event', {
    autoAdvance: true,
    productionId: 1,
    positionList: [],
  });

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

describe('CallSheetItem compact', () => {
  it('is one line with time, title, lanes and duration, without countdown or note', () => {
    const item = showItem('z', 5, 'Opkomst spelers', {isInVenue: true, isInLivestream: true, durationSec: 90, note: 'Toelichting'});
    const {container} = render(<CallSheetItem item={item} compact/>);
    const line = container.querySelector('#event-z') as HTMLElement;
    expect(line.hasAttribute('data-compact')).toBe(true);
    expect(line.textContent).toBe(`${formatSystemTime(item.calculatedTime).slice(0, 5)}Opkomst spelersStreamZaal1:30`);
  });
});

describe('CallSheetItem auto and positions', () => {
  it('shows on a compact line that the item goes on by itself', () => {
    const item = showItem('q', 6, 'Reclame', {autoAdvance: true});
    render(<CallSheetItem item={item} compact/>);
    expect(screen.getByLabelText('Gaat automatisch door')).toBeTruthy();
  });

  it('shows no positions, also in the show caller (they belong to the editor)', () => {
    const item = showItem('p', 6, 'Shots zaal');
    render(<CallSheetItem item={item} hideStreamVenueLabels/>);
    expect(screen.queryByText('Regie livestream')).toBeNull();
  });
});

describe('CallSheetItem alignment', () => {
  it('keeps time, title and duration at the top; a long title wraps below its first line', () => {
    const item = showItem('t', 6, 'Een hele lange titel die op een telefoon over meer regels loopt', {durationSec: 90});
    const compact = render(<CallSheetItem item={item} compact/>).container.querySelector('#event-t') as HTMLElement;
    expect(compact.className).toContain('items-baseline');
    expect(compact.className).not.toContain('items-center');
    const full = render(<CallSheetItem item={{...item, id: 'u'}}/>).container.querySelector('#event-u') as HTMLElement;
    expect((full.firstElementChild as HTMLElement).className).toContain('items-start');
    expect(screen.getByRole('heading').parentElement?.className).toContain('items-baseline');
  });
});
