import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import {CallSheetColumn} from './CallSheetColumn';
import {CAMERA, LED, REGIE, remaining, rustHallDone, rustItems, showItems} from '../test/showCaller';

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

describe('CallSheetColumn hoofdstukken', () => {
  const chapters = [{id: 1, name: 'Voorbeschouwing', order: 1}, {id: 2, name: 'Rust', order: 2}];
  // The camera has 'c' (3) and the everyone-item 'e' (5) in Voorbeschouwing; Rust holds only regie item 'd' (4)
  const inChapters = showItems.map((e) => ({...e, chapterId: e.id === 'd' ? 2 : 1}));
  beforeEach(() => vi.useFakeTimers({toFake: ['Date']}));
  afterEach(() => vi.useRealTimers());

  it('shows a heading per hoofdstuk, "niets voor jou" without own items, and the hoofdstuk in the wait row', () => {
    vi.setSystemTime(next.calculatedTime.getTime() - 270_000);
    render(
      <CallSheetColumn title="Kolom" positionId={CAMERA.id} items={inChapters} activeEvent={{...active, chapterId: 1}}
                       autoAdvanceEventId={null} elapsedTime={0} allPositions={[REGIE, CAMERA]} chapters={chapters}
                       allTimes={['chapter:1', slot(2), slot(4), 'chapter:2', slot(5)]}
                       onPositionChange={() => undefined} secondaryPositionId={null} accentColor="blue" isCompact/>
    );
    const headings = screen.getAllByRole('heading', {level: 2}).map((h) => h.textContent);
    expect(headings).toEqual(['Voorbeschouwing', 'Rust— niets voor jou']);
    expect(screen.getByRole('status').textContent).toContain('Shots zaal');
    expect(screen.getByRole('status').textContent).toContain('· Voorbeschouwing');
  });
});

describe('CallSheetColumn: the hall item next to the stream', () => {
  const slots = rustItems.map((e) => `${e.calculatedTime.toISOString()}#0`);

  it('shows the running hall item as active with its own countdown, and no wait row for the LED', () => {
    render(
      <CallSheetColumn title="LED" positionId={LED.id} items={rustItems} activeEvent={rustItems[2]} activeEventRemainingTime={remaining(90)}
                       activeVenueEvent={rustItems[1]} activeVenueRemainingTime={remaining(75)}
                       autoAdvanceEventId={null} elapsedTime={0} allTimes={slots} allPositions={[REGIE, LED]}
                       onPositionChange={() => undefined} secondaryPositionId={null} accentColor="blue" isCompact/>
    );
    const led = document.getElementById('event-r2') as HTMLElement;
    expect(led.className).toContain('bg-green');
    expect(led.textContent).toContain('1:15');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('waits for the samenkomstpunt once the hall lane is done', () => {
    render(
      <CallSheetColumn title="LED" positionId={LED.id} items={rustHallDone} activeEvent={rustHallDone[4]} activeVenueEvent={null}
                       autoAdvanceEventId={null} elapsedTime={0} allTimes={slots} allPositions={[REGIE, LED]}
                       onPositionChange={() => undefined} secondaryPositionId={null} accentColor="blue" isCompact/>
    );
    expect(within(screen.getByRole('status')).getByText(/Volgende:/).textContent).toContain('Start tweede helft');
  });
});
