import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import DraaiboekItem, {DraaiboekItemData} from './DraaiboekItem';

const positions = [
  {id: 1, name: 'Showcaller', category: 'GENERAL'},
  {id: 2, name: 'Regie livestream', category: 'TECHNICAL', sortOrder: 0},
  {id: 3, name: 'Camera links', category: 'TECHNICAL', sortOrder: 10},
  {id: 4, name: 'Camera rechts', category: 'TECHNICAL', sortOrder: 30},
  {id: 5, name: 'Presentatie', category: 'ENTERTAINMENT'},
  {id: 6, name: 'Muziek', category: 'TECHNICAL', sortOrder: 70},
];
const item: DraaiboekItemData = {
  id: 'a', cue: 'INTRO', title: 'Intro filmpje', note: null, durationSec: 48, isInVenue: true, isInLivestream: true,
  isTimeAnchor: false, anchorType: null, autoAdvance: false, parentId: null, positionIds: [1, 2, 3, 4, 6], timeStart: '2026-11-14T17:55:00.000Z',
};

function renderItem(open = false, overrides: Partial<Parameters<typeof DraaiboekItem>[0]> = {}) {
  const handlers = {onOpen: vi.fn(), onClose: vi.fn(), onSave: vi.fn(async () => undefined), onDelete: vi.fn()};
  render(<DraaiboekItem item={item} handle={{}} positions={positions} fixedPositionIds={[1]} parentOptions={[{id: 'b', label: 'WELKOM: Welkom'}]}
                        open={open} {...handlers} {...overrides}/>);
  return handlers;
}

describe('DraaiboekItem', () => {
  it('shows a quiet line: time, cue, title, labels, at most three positions (without Showcaller) and the duration', () => {
    renderItem();
    const line = screen.getByRole('button', {name: 'Intro filmpje openen'});
    expect(line.textContent).toBe('18:55INTROIntro filmpjeZaalRegie livestreamCamera linksCamera rechts+10:48');
    expect(screen.getByTitle('Muziek')).toBeTruthy();
  });

  it('opens on a click', () => {
    const handlers = renderItem();
    fireEvent.click(screen.getByRole('button', {name: 'Intro filmpje openen'}));
    expect(handlers.onOpen).toHaveBeenCalled();
  });

  it('saves the changed fields, the cue in capitals and Showcaller always on', async () => {
    const handlers = renderItem(true);
    const form = screen.getByRole('form', {name: 'Intro filmpje wijzigen'});
    fireEvent.change(within(form).getByPlaceholderText('Bv. INTRO'), {target: {value: 'intro2'}});
    fireEvent.click(within(form).getByRole('button', {name: 'Camera links weghalen'}));
    fireEvent.click(within(form).getByRole('button', {name: /Positie/}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Zoek een positie'}), {target: {value: 'pres'}});
    const picker = screen.getByRole('dialog', {name: 'Posities kiezen'});
    expect(within(picker).queryByText('Camera rechts')).toBeNull();
    fireEvent.click(within(picker).getByRole('checkbox', {name: 'Presentatie'}));
    fireEvent.click(within(form).getByRole('button', {name: 'Opslaan'}));
    await waitFor(() => expect(handlers.onSave).toHaveBeenCalledWith(expect.objectContaining({cue: 'INTRO2', positionIds: [1, 2, 4, 6, 5]})));
  });
});

describe('DraaiboekItem lanes', () => {
  it('shows the lane of an item that runs in parallel with a green (Zaal) or blue (Stream) edge', () => {
    const {container, rerender} = render(<DraaiboekItem item={{...item, isInLivestream: false}} handle={{}} positions={positions} parentOptions={[]} open={false}
                                                        onOpen={vi.fn()} onClose={vi.fn()} onSave={vi.fn(async () => undefined)} onDelete={vi.fn()} lane="ZAAL"/>);
    const row = container.querySelector('[data-lane]') as HTMLElement;
    expect(row.dataset.lane).toBe('ZAAL');
    expect(row.className).toContain('border-l-emerald-500');
    expect(screen.getByText('Baan Zaal')).toBeTruthy();
    rerender(<DraaiboekItem item={{...item, isInVenue: false}} handle={{}} positions={positions} parentOptions={[]} open={false}
                            onOpen={vi.fn()} onClose={vi.fn()} onSave={vi.fn(async () => undefined)} onDelete={vi.fn()}/>);
    expect(container.querySelector('[data-lane]')).toBeNull();
  });

  it('shows a template item\'s start relative to the kickoff', () => {
    renderItem(false, {item: {...item, timeStart: undefined, startOffsetSec: 2100}});
    expect(screen.getByTitle('t.o.v. de aftrap').textContent).toBe('+35:00');
  });
});
