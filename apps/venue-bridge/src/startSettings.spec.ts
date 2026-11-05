import {describe, expect, it} from 'vitest';
import {loadStartSettings, StartSettingsError} from './startSettings';

describe('start settings', () => {
  it('loads the settings with defaults', () => {
    const s = loadStartSettings({API_URL: 'https://api.example.org/', API_KEY: 'k3y'});
    expect(s).toMatchObject({apiUrl: 'https://api.example.org', name: 'venue-bridge', port: 3340, host: '0.0.0.0', configFile: '/data/venue-bridge.json'});
  });

  it('refuses a missing key and a missing URL', () => {
    expect(() => loadStartSettings({API_URL: 'https://api.example.org'})).toThrow('API_KEY ontbreekt');
    expect(() => loadStartSettings({API_KEY: 'k3y'})).toThrow('API_URL ontbreekt');
    expect(() => loadStartSettings({API_URL: 'https://api.example.org', API_KEY: ''})).toThrow(StartSettingsError);
  });

  it('never puts the key in an error', () => {
    try {
      loadStartSettings({API_URL: 'not a url', API_KEY: 'sup3rs3cret', PORT: 'abc'});
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain('sup3rs3cret');
    }
  });
});
