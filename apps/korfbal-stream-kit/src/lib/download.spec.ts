import {describe, expect, it, vi} from 'vitest';
import {downloadFromApi, fileNameFromDisposition} from './download';
import {jsonResponse} from '../test/organizations';

describe('downloads from the API', () => {
  it('takes the file name from Content-Disposition', () => {
    expect(fileNameFromDisposition('attachment; filename="skills.json"')).toBe('skills.json');
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''draaiboek%20%C3%A9%C3%A9n.xlsx")).toBe('draaiboek één.xlsx');
    expect(fileNameFromDisposition(null)).toBeNull();
  });

  it('fetches (so X-Organization goes along) and shows the API\'s error', async () => {
    global.fetch = vi.fn(async () => jsonResponse({error: 'Kies een organisatie'}, 401)) as unknown as typeof fetch;
    await expect(downloadFromApi('/api/skills/export-json', 'skills.json')).rejects.toThrow('Kies een organisatie');
    expect(global.fetch).toHaveBeenCalledWith('/api/skills/export-json');
  });
});
