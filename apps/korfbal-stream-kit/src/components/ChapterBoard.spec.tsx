import {afterEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import ChapterBoard from './ChapterBoard';

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
