import {describe, expect, it} from 'vitest';
import {
  ConfigApplyRequestSchema, StatsAnswerSchema, VenueConfigSchema, VenueReadingSchema, VmixCallRequestSchema,
  colorForShotclock, enrichShotclock, parseVenueTime, VENUE_EVENTS,
} from './index';

const readAt = '2026-11-05T10:00:00.000Z';
const config = {
  scoreboard: {url: 'http://10.0.0.5:8080'},
  shotclock: {url: null},
  stats: {pageUrl: 'http://10.0.0.6/tweede.html', mdbPath: 'F{team}/WEDSTRIJDEN.mdb', mdbEnabled: true, shareHost: null, keepCopy: true},
  vmix: {instances: [{id: 'main', name: 'Main', url: 'http://10.0.0.7:8088'}], targets: {countdown: 'main', callsheet: ''}},
  version: 'abc123',
};

describe('VenueReadingSchema', () => {
  it('accepts a valid reading', () => {
    expect(VenueReadingSchema.safeParse({device: 'clock', ok: true, data: ['15', '34'], readAt}).success).toBe(true);
    expect(VenueReadingSchema.safeParse({device: 'score', ok: false, data: [], error: 'unreachable', readAt}).success).toBe(true);
  });
  it('refuses a wrong device or error', () => {
    expect(VenueReadingSchema.safeParse({device: 'vmix', ok: true, data: [], readAt}).success).toBe(false);
    expect(VenueReadingSchema.safeParse({device: 'clock', ok: false, data: [], error: 'boom', readAt}).success).toBe(false);
  });
  it('refuses data that is not an array, has more than 20 items or exceeds 4 KB', () => {
    expect(VenueReadingSchema.safeParse({device: 'clock', ok: true, data: {time: 1}, readAt}).success).toBe(false);
    expect(VenueReadingSchema.safeParse({device: 'clock', ok: true, data: new Array(21).fill(1), readAt}).success).toBe(false);
    expect(VenueReadingSchema.safeParse({device: 'clock', ok: true, data: ['x'.repeat(5000)], readAt}).success).toBe(false);
  });
});

describe('VenueConfigSchema', () => {
  it('accepts a configuration and fills the vMix defaults', () => {
    expect(VenueConfigSchema.safeParse(config).success).toBe(true);
    expect(ConfigApplyRequestSchema.safeParse({config}).success).toBe(true);
  });
  it('refuses a path with ../ and an absolute database path', () => {
    expect(VenueConfigSchema.safeParse({...config, stats: {...config.stats, mdbPath: '../x.mdb'}}).success).toBe(false);
    expect(VenueConfigSchema.safeParse({...config, stats: {...config.stats, mdbPath: '/x.mdb'}}).success).toBe(false);
  });
  it('refuses a target that is not an instance', () => {
    expect(VenueConfigSchema.safeParse({...config, vmix: {...config.vmix, targets: {countdown: 'other', callsheet: ''}}}).success).toBe(false);
  });
});

describe('requests', () => {
  it('needs a Function in each vMix command', () => {
    expect(VmixCallRequestSchema.safeParse({function: 'callsheet', commands: [{Function: 'SetText', Value: 'x'}]}).success).toBe(true);
    expect(VmixCallRequestSchema.safeParse({function: 'callsheet', commands: [{Value: 'x'}]}).success).toBe(false);
    expect(VmixCallRequestSchema.safeParse({function: 'other', commands: [{Function: 'x'}]}).success).toBe(false);
  });
  it('knows a stats answer', () => {
    expect(StatsAnswerSchema.safeParse({status: 200, headers: {}, body: []}).success).toBe(true);
    expect(StatsAnswerSchema.safeParse({status: 99, headers: {}, body: []}).success).toBe(false);
  });
  it('names the events', () => {
    expect(Object.values(VENUE_EVENTS)).toEqual(['venue:reading', 'config:apply', 'stats:request', 'vmix:call', 'vmix:inputs']);
  });
});

describe('parseVenueTime', () => {
  it('reads strings and minute/second objects, else empty', () => {
    expect(parseVenueTime(['15', '34'])).toBe('15:34');
    expect(parseVenueTime([{minute: 3, second: 7}])).toBe('3:7');
    expect(parseVenueTime([])).toBe('');
    expect(parseVenueTime({time: 1})).toBe('');
  });
});

describe('shot clock colour', () => {
  it('is red up to 10, orange up to 15, green above', () => {
    expect([10, 11, 15, 16].map(colorForShotclock)).toEqual(['red', 'orange', 'orange', 'green']);
  });
  it('enriches items and leaves a non-number without colour', () => {
    expect(enrichShotclock([{time: 12}, {time: 'x'}])).toEqual([{time: 12, color: 'orange'}, {time: 'x', color: undefined}]);
  });
});
