import {beforeEach, describe, expect, it, vi} from 'vitest';
import {setConfigForTests} from '../config';
import {clearStatusCache, statsConnection} from './connectionTest';

const state = {reachable: true, probes: 0, stamps: 0};

vi.mock('./smbReach', async (original) => ({
  ...(await original<typeof import('./smbReach')>()),
  smbReachable: async () => {
    state.probes += 1;
    await new Promise((r) => setTimeout(r, 20));
    return {ok: state.reachable, ms: 1};
  },
}));
vi.mock('./mdbFile', async (original) => ({
  ...(await original<typeof import('./mdbFile')>()),
  sharedFileStamp: async () => {
    state.stamps += 1;
    return '1:1';
  },
}));
vi.mock('./liveStats', () => ({getLiveStats: async () => ({})}));

describe('statsConnection', () => {
  beforeEach(() => {
    clearStatusCache();
    Object.assign(state, {reachable: true, probes: 0, stamps: 0});
    setConfigForTests({statsDir: '/share', mdbPath: 'F{team}/WEDSTRIJDEN.mdb', shareHost: '10.12.0.63', pageUrl: null, mdbEnabled: true});
  });

  it('shares one running check and reuses the answer for a few seconds', async () => {
    const [a, b] = await Promise.all([statsConnection('2'), statsConnection('2')]);
    await statsConnection('2');
    expect(a).toEqual(b);
    expect(a.team).toEqual({value: '2'});
    expect(state.probes).toBe(1);
    expect(state.stamps).toBe(1);
  });

  it('only tries the file when the PC answered on the network', async () => {
    state.reachable = false;
    const result = await statsConnection('1');
    expect(result.network).toMatchObject({ok: false});
    expect(result.database).toBeNull();
    expect(state.stamps).toBe(0);
  });

  it('reports database "disabled" without probing the share or touching the file', async () => {
    setConfigForTests({mdbEnabled: false});
    const result = await statsConnection('1');
    expect(result.database).toBe('disabled');
    expect(result.network).toBeNull();
    expect(state.probes).toBe(0);
    expect(state.stamps).toBe(0);
  });
});
