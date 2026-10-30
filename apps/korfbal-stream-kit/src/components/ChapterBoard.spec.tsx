import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import ChapterBoard, {parseMinimum} from './ChapterBoard';

const chapters = [{id: 'voor', name: 'Voorbereiding', subtitle: '−30:00 tot 0:00'}, {id: 'eerste', name: 'Eerste helft'}];
const items = [{id: 'kabels', title: 'Kabels checken'}, {id: 'aftrap', title: 'Aftrap'}];
const structure = [{id: 'voor', itemIds: ['kabels']}, {id: 'eerste', itemIds: ['aftrap']}];

function renderBoard(overrides: Partial<Parameters<typeof ChapterBoard>[0]> = {}) {
  const handlers = {
    onStructureChange: vi.fn(), onAddItem: vi.fn(), onAddChapter: vi.fn(), onRenameChapter: vi.fn(), onDeleteChapter: vi.fn(),
  };
  render(
    <ChapterBoard chapters={chapters} items={items} structure={structure} renderItem={(item) => <div>{item.title}</div>} {...handlers} {...overrides}/>
  );
  return handlers;
}

describe('ChapterBoard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows every hoofdstuk with its subtitle, item count and items in order', () => {
    renderBoard();
    const voor = screen.getByRole('region', {name: 'Hoofdstuk Voorbereiding'});
    expect(within(voor).getByText('−30:00 tot 0:00')).toBeTruthy();
    expect(within(voor).getByText('(1)')).toBeTruthy();
    expect(within(voor).getByText('Kabels checken')).toBeTruthy();
    expect(within(screen.getByRole('region', {name: 'Hoofdstuk Eerste helft'})).getByText('Aftrap')).toBeTruthy();
  });

  it('adds an item to a hoofdstuk and a new hoofdstuk at the end', async () => {
    const handlers = renderBoard();
    fireEvent.click(screen.getByRole('button', {name: 'Item toevoegen aan Eerste helft'}));
    expect(handlers.onAddItem).toHaveBeenCalledWith('eerste');
    fireEvent.change(screen.getByRole('textbox', {name: 'Naam van het nieuwe hoofdstuk'}), {target: {value: 'Rust'}});
    fireEvent.click(screen.getByRole('button', {name: /Hoofdstuk toevoegen/}));
    await waitFor(() => expect(handlers.onAddChapter).toHaveBeenCalledWith('Rust'));
  });

  it('renames a hoofdstuk', async () => {
    const handlers = renderBoard();
    fireEvent.click(screen.getByRole('button', {name: 'Naam van Voorbereiding wijzigen'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Naam van het hoofdstuk'}), {target: {value: 'Checklist'}});
    fireEvent.click(screen.getByRole('button', {name: 'Naam opslaan'}));
    await waitFor(() => expect(handlers.onRenameChapter).toHaveBeenCalledWith('voor', 'Checklist'));
  });

  it('asks where the items go before deleting a hoofdstuk that has items', async () => {
    const handlers = renderBoard();
    fireEvent.click(screen.getByRole('button', {name: 'Hoofdstuk Voorbereiding verwijderen'}));
    const dialog = screen.getByRole('alertdialog', {name: 'Hoofdstuk verwijderen'});
    expect(within(dialog).getByRole('combobox', {name: 'Items verplaatsen naar'})).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Verplaatsen en verwijderen'}));
    await waitFor(() => expect(handlers.onDeleteChapter).toHaveBeenCalledWith('voor', [{id: 'eerste', itemIds: ['aftrap', 'kabels']}]));
  });

  it('deletes an empty hoofdstuk after a confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const handlers = renderBoard({structure: [{id: 'voor', itemIds: []}, {id: 'eerste', itemIds: ['kabels', 'aftrap']}]});
    fireEvent.click(screen.getByRole('button', {name: 'Hoofdstuk Voorbereiding verwijderen'}));
    await waitFor(() => expect(handlers.onDeleteChapter).toHaveBeenCalledWith('voor', [{id: 'eerste', itemIds: ['kabels', 'aftrap']}]));
  });
});

describe('ChapterBoard: Minimale duur', () => {
  const rust = [{id: 'voor', name: 'Rust', minDurationSec: 600, overrunSec: 0}, {id: 'eerste', name: 'Eerste helft', minDurationSec: null, overrunSec: 0}];

  it('reads mm:ss (or minutes) and saves it in seconds; empty means as long as its items', async () => {
    const onChangeMinimum = vi.fn();
    renderBoard({chapters: rust, onChangeMinimum});
    const field = screen.getByRole('textbox', {name: 'Minimale duur van Rust'}) as HTMLInputElement;
    expect(field.value).toBe('10:00');
    fireEvent.change(field, {target: {value: '12:30'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(onChangeMinimum).toHaveBeenCalledWith('voor', 750));

    const other = screen.getByRole('textbox', {name: 'Minimale duur van Eerste helft'});
    fireEvent.change(other, {target: {value: '35'}});
    fireEvent.blur(other);
    await waitFor(() => expect(onChangeMinimum).toHaveBeenCalledWith('eerste', 2100));

    fireEvent.change(field, {target: {value: ''}});
    fireEvent.blur(field);
    await waitFor(() => expect(onChangeMinimum).toHaveBeenCalledWith('voor', null));
  });

  it('refuses what isn\'t a duration, without saving', () => {
    const onChangeMinimum = vi.fn();
    renderBoard({chapters: rust, onChangeMinimum});
    const field = screen.getByRole('textbox', {name: 'Minimale duur van Rust'});
    fireEvent.change(field, {target: {value: '10 min'}});
    fireEvent.blur(field);
    expect(screen.getByRole('alert').textContent).toBe('Gebruik mm:ss, bv. 10:00');
    expect(onChangeMinimum).not.toHaveBeenCalled();
  });

  it('says how much longer the items run than the minimum', () => {
    renderBoard({chapters: [{...rust[0], overrunSec: 95}, rust[1]], onChangeMinimum: vi.fn()});
    const voor = screen.getByRole('region', {name: 'Hoofdstuk Rust'});
    expect(within(voor).getByRole('status').textContent).toBe('loopt 1:35 langer dan de minimale duur');
    expect(within(screen.getByRole('region', {name: 'Hoofdstuk Eerste helft'})).queryByRole('status')).toBeNull();
  });

  it('parses minimums like the API takes them', () => {
    expect(parseMinimum('10:00')).toBe(600);
    expect(parseMinimum('0:45')).toBe(45);
    expect(parseMinimum('0')).toBeNull();
    expect(parseMinimum(' ')).toBeNull();
    expect(parseMinimum('1441')).toBeUndefined();
    expect(parseMinimum('5:75')).toBeUndefined();
  });
});
