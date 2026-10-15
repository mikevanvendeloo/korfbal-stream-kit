import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import axios from 'axios';
import * as appSettings from './appSettings';
import * as timing from './callsheetTiming';
import * as instances from './vmixInstances';
import {VmixCallsheetPushSchema} from '../schemas/vmixCallsheet';
import {buildVmixCommands, buildVmixCommandUrl, getCallsheetPushConfig, pushCallsheetToVmix} from './vmixCallsheetPush';

vi.mock('axios');
vi.mock('./appSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof appSettings>();
  return {...actual, getSetting: vi.fn(), setSetting: vi.fn()};
});
vi.mock('./vmixInstances', () => ({resolveVmixInstance: vi.fn()}));
vi.mock('./callsheetTiming', async (importOriginal) => {
  const actual = await importOriginal<typeof timing>();
  return {...actual, loadCallsheetTiming: vi.fn()};
});

const NOW = new Date('2026-10-12T18:00:00.000Z');

const config = VmixCallsheetPushSchema.parse({
  enabled: true,
  input: 'Callsheet',
  current: {titleField: 'Titel.Text', timerField: 'Timer.Text', backgroundField: 'Achtergrond', textColorFields: ['Timer.Text']},
  next: {titleField: 'Volgend.Text', durationField: 'VolgendDuur.Text', backgroundField: 'VolgendAchtergrond'},
});

function timingWith(overrides: Partial<timing.CallsheetTiming>): timing.CallsheetTiming {
  const empty = timing.buildCallsheetTiming({productionId: null, events: [], activeEventId: null, positions: [], warningSeconds: 10, now: NOW});
  return {...empty, ...overrides};
}

describe('buildVmixCommands', () => {
  it('sets the configured texts and the colours that belong to the state', () => {
    const commands = buildVmixCommands(timingWith({
      currentTitle: 'Opening', currentRemaining: '-00:12', currentState: 'overtime',
      nextTitle: 'Interview', nextDuration: '02:00', nextState: 'warning',
    }), config);

    expect(commands).toEqual([
      {function: 'SetText', selectedName: 'Titel.Text', value: 'Opening'},
      {function: 'SetText', selectedName: 'Timer.Text', value: '-00:12'},
      {function: 'SetColor', selectedName: 'Achtergrond', value: '#EF4444'},
      {function: 'SetTextColour', selectedName: 'Timer.Text', value: '#FFFFFF'},
      {function: 'SetText', selectedName: 'Volgend.Text', value: 'Interview'},
      {function: 'SetText', selectedName: 'VolgendDuur.Text', value: '02:00'},
      {function: 'SetColor', selectedName: 'VolgendAchtergrond', value: '#F97316'},
    ]);
  });

  it('builds a vMix function URL with encoded values', () => {
    expect(buildVmixCommandUrl('http://vmix:8088', 'Callsheet', {function: 'SetColor', selectedName: 'Achtergrond', value: '#22C55E'}))
      .toBe('http://vmix:8088/api?Function=SetColor&Input=Callsheet&SelectedName=Achtergrond&Value=%2322C55E');
  });
});

describe('one position', () => {
  afterEach(() => vi.resetAllMocks());

  it('accepts one position, or none for every item, but not two', () => {
    expect(VmixCallsheetPushSchema.parse({}).positions).toEqual(['Presentatie']);
    expect(VmixCallsheetPushSchema.safeParse({positions: []}).success).toBe(true);
    expect(VmixCallsheetPushSchema.safeParse({positions: ['Presentatie', 'Analist']}).success).toBe(false);
  });

  it('keeps the first position of settings saved when several were allowed', async () => {
    vi.mocked(appSettings.getSetting).mockResolvedValue({...config, positions: ['Analist', 'Presentatie']});
    const read = await getCallsheetPushConfig();
    expect(read.positions).toEqual(['Analist']);
    expect(read.input).toBe('Callsheet');
  });
});

describe('pushCallsheetToVmix', () => {
  beforeEach(() => {
    vi.mocked(appSettings.getSetting).mockResolvedValue(config);
    vi.mocked(instances.resolveVmixInstance).mockResolvedValue({instance: {id: 'scherm', name: 'Scherm-PC', url: 'http://vmix:8088'}});
    vi.mocked(axios.get).mockResolvedValue({data: ''});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('only sends what changed since the previous push', async () => {
    vi.mocked(timing.loadCallsheetTiming).mockResolvedValue(timingWith({currentTitle: 'Opening', currentRemaining: '00:30'}));
    const first = await pushCallsheetToVmix(true, NOW);
    expect(first.sent).toBe(7);

    vi.mocked(axios.get).mockClear();
    vi.mocked(timing.loadCallsheetTiming).mockResolvedValue(timingWith({currentTitle: 'Opening', currentRemaining: '00:29'}));
    const second = await pushCallsheetToVmix(false, new Date(NOW.getTime() + 1000));
    expect(second).toMatchObject({sent: 1, skipped: 6, errors: []});
    expect(vi.mocked(axios.get).mock.calls[0][0]).toContain('SelectedName=Timer.Text&Value=00%3A29');
  });

  it('retries a field when vMix did not accept it', async () => {
    vi.mocked(timing.loadCallsheetTiming).mockResolvedValue(timingWith({currentTitle: 'Opening'}));
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const first = await pushCallsheetToVmix(true, NOW);
    expect(first.errors).toEqual(['SetText Titel.Text: ECONNREFUSED']);

    vi.mocked(axios.get).mockClear();
    const second = await pushCallsheetToVmix(false, new Date(NOW.getTime() + 1000));
    expect(second.sent).toBe(1);
  });

  it('sends to the vMix chosen for the callsheet', async () => {
    vi.mocked(timing.loadCallsheetTiming).mockResolvedValue(timingWith({currentTitle: 'Opening'}));
    await pushCallsheetToVmix(true, NOW);
    expect(instances.resolveVmixInstance).toHaveBeenCalledWith('callsheet');
    expect(vi.mocked(axios.get).mock.calls[0][0]).toMatch(/^http:\/\/vmix:8088\/api\?/);
  });

  it('does nothing without a vMix instance', async () => {
    vi.mocked(instances.resolveVmixInstance).mockResolvedValue({error: 'vMix Web URL is not configured'});
    expect((await pushCallsheetToVmix(true, NOW)).errors).toEqual(['vMix Web URL is not configured']);
    expect(axios.get).not.toHaveBeenCalled();
  });
});
