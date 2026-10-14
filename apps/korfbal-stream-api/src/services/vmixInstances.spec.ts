import {afterEach, describe, expect, it, vi} from 'vitest';
import * as appSettings from './appSettings';
import {assignIds, getVmixInstancesConfig, resolveVmixInstance, setFirstVmixUrl, setVmixInstancesConfig, VMIX_INSTANCES_KEY} from './vmixInstances';
import {VmixInstancesConfigSchema} from '../schemas/vmixInstances';

vi.mock('./appSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof appSettings>();
  return {...actual, getSetting: vi.fn(), setSetting: vi.fn()};
});

function stored(values: Record<string, unknown>) {
  vi.mocked(appSettings.getSetting).mockImplementation(async (key: string) => (values[key] ?? null) as never);
}

const twoInstances = {
  instances: [
    {id: 'stream-pc', name: 'Stream-PC', url: 'http://10.0.0.10:8088'},
    {id: 'scherm-pc', name: 'Scherm-PC', url: 'http://10.0.0.11:8088'},
  ],
  targets: {countdown: '', callsheet: 'scherm-pc'},
};

describe('vMix instances', () => {
  afterEach(() => vi.resetAllMocks());

  it('turns the single vMix URL from before into the first instance', async () => {
    stored({vmixWebUrl: 'http://10.0.0.10:8088'});
    expect(await getVmixInstancesConfig()).toEqual({
      instances: [{id: 'vmix', name: 'vMix', url: 'http://10.0.0.10:8088'}],
      targets: {countdown: '', callsheet: ''},
    });
  });

  it('sends each function to its own instance, and to the first one when none is chosen', async () => {
    stored({[VMIX_INSTANCES_KEY]: twoInstances});
    expect(await resolveVmixInstance('callsheet')).toEqual({instance: twoInstances.instances[1]});
    expect(await resolveVmixInstance('countdown')).toEqual({instance: twoInstances.instances[0]});
    expect(await resolveVmixInstance('countdown', 'scherm-pc')).toEqual({instance: twoInstances.instances[1]});
    expect(await resolveVmixInstance('countdown', 'weg')).toEqual({error: 'vMix instance "weg" is not configured'});
  });

  it('reports a missing vMix when nothing is configured', async () => {
    stored({});
    expect(await resolveVmixInstance('countdown')).toEqual({error: 'vMix Web URL is not configured'});
  });

  it('gives new instances a unique id from their name', () => {
    expect(assignIds([
      {id: 'scherm-pc', name: 'Scherm PC', url: 'http://a:8088'},
      {name: 'Scherm PC!', url: 'http://b:8088'},
      {name: 'Ünïcode', url: 'http://c:8088'},
    ]).map((i) => i.id)).toEqual(['scherm-pc', 'scherm-pc-2', 'unicode']);
  });

  it('rejects duplicate names and targets that point nowhere', () => {
    const duplicate = VmixInstancesConfigSchema.safeParse({instances: [{name: 'A', url: 'http://a'}, {name: 'a', url: 'http://b'}]});
    expect(duplicate.success).toBe(false);
    const unknown = VmixInstancesConfigSchema.safeParse({instances: [{id: 'a', name: 'A', url: 'http://a'}], targets: {callsheet: 'b'}});
    expect(unknown.success).toBe(false);
  });

  it('keeps the single URL in step with the first instance', async () => {
    stored({[VMIX_INSTANCES_KEY]: twoInstances});
    await setFirstVmixUrl('http://10.0.0.20:8088');
    expect(appSettings.setSetting).toHaveBeenCalledWith(VMIX_INSTANCES_KEY, {
      ...twoInstances,
      instances: [{...twoInstances.instances[0], url: 'http://10.0.0.20:8088'}, twoInstances.instances[1]],
    });
    expect(appSettings.setSetting).toHaveBeenCalledWith('vmixWebUrl', 'http://10.0.0.20:8088');

    vi.mocked(appSettings.setSetting).mockClear();
    await setVmixInstancesConfig({instances: []});
    expect(appSettings.setSetting).toHaveBeenCalledWith('vmixWebUrl', null);
  });
});
