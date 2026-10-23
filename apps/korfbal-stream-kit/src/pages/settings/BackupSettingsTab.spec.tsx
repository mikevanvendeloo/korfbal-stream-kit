import {fireEvent, screen, waitFor} from '@testing-library/react';
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
    const {calls} = mockApi(() => zip);
    const createObjectURL = vi.fn(() => 'blob:zip');
    Object.assign(URL, {createObjectURL, revokeObjectURL: vi.fn()});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    renderPage(<BackupSettingsTab/>);
    expect(screen.getByText(/pak uit in de map storage\//)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Afbeeldingen downloaden'}));

    await waitFor(() => expect(screen.getByText('Afbeeldingen gedownload')).toBeTruthy());
    expect(calls.map((c) => c.path)).toEqual(['/api/backup/images']);
    expect(click).toHaveBeenCalled();
  });

  it('shows the error when the download fails', async () => {
    mockApi(() => new Response(JSON.stringify({error: 'Interne serverfout'}), {status: 500, headers: {'Content-Type': 'application/json'}}));
    renderPage(<BackupSettingsTab/>);
    fireEvent.click(screen.getByRole('button', {name: 'Afbeeldingen downloaden'}));
    await waitFor(() => expect(screen.getByText('Fout bij downloaden: Interne serverfout')).toBeTruthy());
  });
});
