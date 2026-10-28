import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import {CallSheetColumn} from './CallSheetColumn';
import {CAMERA, REGIE, showItems} from '../test/showCaller';

vi.mock('../hooks/useFontSize', () => ({useFontSize: () => ({fontSize: 'm'})}));

const active = showItems[1]; // 'b', for the regie
const next = showItems[2]; // 'c', the camera's next item

function renderColumn(positionId: number, allTimes: string[]) {
  return render(
    <CallSheetColumn title="Kolom" positionId={positionId} items={showItems} activeEvent={active}
                     autoAdvanceEventId={null} elapsedTime={0} allTimes={allTimes} allPositions={[REGIE, CAMERA]}
                     onPositionChange={() => undefined} secondaryPositionId={null} accentColor="blue" isCompact/>
  );
}

const slot = (i: number) => `${showItems[i].calculatedTime.toISOString()}#0`;
const cameraOnly = [2, 4, 5].map(slot);

describe('CallSheetColumn wait row', () => {
  beforeEach(() => vi.useFakeTimers({toFake: ['Date']}));
  afterEach(() => vi.useRealTimers());

  it('stands right before the next item and counts down to it', () => {
    vi.setSystemTime(next.calculatedTime.getTime() - 270_000);
    const {container} = renderColumn(CAMERA.id, cameraOnly);
    const wait = screen.getByRole('status');
    expect(wait.textContent).toContain('Even niets voor jou');
    expect(wait.textContent).toContain('nog 4:30');
    expect(within(wait).getByText(/Volgende:/).textContent).toContain('Shots zaal');
    expect(wait.nextElementSibling?.id).toBe(`event-${next.id}`);
    expect(container.querySelectorAll('[data-callsheet-wait]')).toHaveLength(1);
  });

  it('says "Maak je klaar" in the last 30 seconds, and without a time once it is due', () => {
    vi.setSystemTime(next.calculatedTime.getTime() - 30_000);
    const {unmount} = renderColumn(CAMERA.id, cameraOnly);
    expect(screen.getByRole('status').textContent).toContain('Maak je klaarnog 0:30');
    unmount();

    vi.setSystemTime(next.calculatedTime.getTime() + 5_000);
    renderColumn(CAMERA.id, cameraOnly);
    expect(screen.getByRole('status').textContent).not.toContain('nog');
  });

  it('takes the active item\'s place when another column shows it', () => {
    renderColumn(CAMERA.id, [1, 2, 4, 5].map(slot));
    expect(screen.getByRole('status').nextElementSibling?.id).toBe(`event-${next.id}`);
    expect(screen.getByRole('status').previousElementSibling).toBeNull();
  });

  it('is not there for the position that has the active item', () => {
    renderColumn(REGIE.id, [0, 1, 3, 4].map(slot));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
