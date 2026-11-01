import {beforeEach, describe, expect, it, vi} from 'vitest';
import {runWithOrganization} from '../organizationContext';

const state = {reachable: true, probes: 0, stamps: 0};

vi.mock('../appSettings', () => ({getMatchStats: async () => ({pageUrl: null, mdbPath: 'F1/WEDSTRIJDEN.mdb', keepCopy: true, shareHost: '10.12.0.63'})}));
vi.mock('../config', () => ({config: {statsDir: '/share'}}));
vi.mock('./smbReach', async (original) => ({
  ...(await original<typeof import('./smbReach')>()),
  smbReachable: async () => {
    state.probes += 1;
    await new Promise((r) => setTimeout(r, 20));
    return {ok: state.reachable, ms: 1};
  },
}));
vi.mock('./mdbFile', () => ({
  sharedFileStamp: async () => {
    state.stamps += 1;
    return '1:1';
  },
}));
vi.mock('./liveStats', () => ({getLiveStats: async () => ({})}));

const {statsConnection, clearStatusCache} = await import('./connectionTest');
const inOrg = <T>(fn: () => Promise<T>) => runWithOrganization(3, fn, 'status-unit');

describe('statsConnection', () => {
  beforeEach(() => {
    clearStatusCache();
    Object.assign(state, {reachable: true, probes: 0, stamps: 0});
  });

  it('shares one running check and reuses the answer for a few seconds', async () => {
    const [a, b] = await Promise.all([inOrg(statsConnection), inOrg(statsConnection)]);
    await inOrg(statsConnection);
    expect(a).toEqual(b);
    expect(state.probes).toBe(1);
    expect(state.stamps).toBe(1);
  });

  it('only tries the file when the PC answered on the network', async () => {
    state.reachable = false;
    const result = await inOrg(statsConnection);
    expect(result.network).toMatchObject({ok: false});
    expect(result.file).toBeNull();
    expect(state.stamps).toBe(0);
  });
});
