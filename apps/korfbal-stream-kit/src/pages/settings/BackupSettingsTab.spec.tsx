import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import BackupSettingsTab from './BackupSettingsTab';
import {mockApi, renderPage} from '../../test/organizations';

describe('BackupSettingsTab: images', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the images zip through fetch (so X-Organization goes along) and says where to unpack it', async () => {
    const zip = new Response(new Blob(['PK']), {
      status: 200,
      headers: {'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="afbeeldingen-fortuna-2026-10-23.zip"'},
    });
    const {calls} = mockApi(({path}) => (path === '/api/backup/images' ? zip : []));
    const createObjectURL = vi.fn(() => 'blob:zip');
    Object.assign(URL, {createObjectURL, revokeObjectURL: vi.fn()});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    renderPage(<BackupSettingsTab/>);
    expect(screen.getByText(/pak uit in de map storage\//)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Afbeeldingen downloaden'}));

    await waitFor(() => expect(screen.getByText('Afbeeldingen gedownload')).toBeTruthy());
    expect(calls.map((c) => c.path).filter((p) => p.startsWith('/api/backup'))).toEqual(['/api/backup/images']);
    expect(click).toHaveBeenCalled();
  });

  it('shows the error when the download fails', async () => {
    mockApi(() => new Response(JSON.stringify({error: 'Interne serverfout'}), {status: 500, headers: {'Content-Type': 'application/json'}}));
    renderPage(<BackupSettingsTab/>);
    fireEvent.click(screen.getByRole('button', {name: 'Afbeeldingen downloaden'}));
    await waitFor(() => expect(screen.getByText('Fout bij downloaden: Interne serverfout')).toBeTruthy());
  });
});

describe('BackupSettingsTab: clubs from before the seasons', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks the season of players without one, and restores only after it is chosen', async () => {
    const {calls} = mockApi(({method, path}) => {
      if (path === '/api/seasons') return [{id: 1, name: '2025/2026'}, {id: 2, name: '2026/2027'}];
      if (method === 'POST' && path === '/api/backup/clubs/import') {
        return new Response(JSON.stringify({error: 'Kies het seizoen van de spelers', code: 'PLAYER_SEASON_REQUIRED', playersWithoutSeason: 245}),
          {status: 400, headers: {'Content-Type': 'application/json'}});
      }
      if (method === 'POST' && path === '/api/backup/clubs/import?seasonId=1') return {ok: true, created: 0, updated: 10};
      return {};
    });
    renderPage(<BackupSettingsTab/>);

    const row = screen.getByRole('heading', {name: 'Clubs'}).parentElement?.parentElement as HTMLElement;
    const file = new File([JSON.stringify([{name: 'Fortuna', slug: 'fortuna', players: [{name: 'Oud'}]}])], 'clubs.json', {type: 'application/json'});
    fireEvent.change(within(row).getByText('Restore').parentElement?.querySelector('input') as HTMLInputElement, {target: {files: [file]}});

    const group = await screen.findByRole('group', {name: 'Seizoen van de spelers'});
    expect(group.textContent).toContain('245 spelers hebben geen seizoen');
    const confirm = within(group).getByRole('button', {name: 'Herstellen in dit seizoen'}) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await waitFor(() => expect(within(group).getAllByRole('option')).toHaveLength(3));
    fireEvent.change(within(group).getByRole('combobox', {name: 'Seizoen'}), {target: {value: '1'}});
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.getByText('Herstel voltooid: 0 nieuw, 10 bijgewerkt')).toBeTruthy());
    expect(screen.queryByRole('group', {name: 'Seizoen van de spelers'})).toBeNull();
    const posts = calls.filter((c) => c.method === 'POST').map((c) => c.path);
    expect(posts).toEqual(['/api/backup/clubs/import', '/api/backup/clubs/import?seasonId=1']);
  });
});
