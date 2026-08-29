import {afterEach, describe, expect, it, vi} from 'vitest';
import axios from 'axios';
import {VrijwilligersMatchScheduleProvider} from './VrijwilligersMatchScheduleProvider';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

afterEach(() => {
  vi.resetAllMocks();
});

function makeProvider(baseUrl = 'https://provider.example.com/v1', apiToken?: string) {
  return new VrijwilligersMatchScheduleProvider(() => baseUrl, () => apiToken);
}

describe('VrijwilligersMatchScheduleProvider', () => {
  it('requests the programs endpoint with the expected query params', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({data: []});
    const provider = makeProvider();

    await provider.fetchMatches({date: '2025-11-01', location: 'HOME'});

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    const [calledUrl] = mockedAxios.get.mock.calls[0];
    const url = new URL(calledUrl as string);
    expect(url.pathname).toBe('/v1/programs');
    expect(url.searchParams.get('date')).toBe('2025-11-01');
    expect(url.searchParams.get('reserves')).toBe('false');
    expect(url.searchParams.get('location')).toBe('HOME');
    expect(url.searchParams.get('levelType')).toBe('ALL');
    expect(url.searchParams.get('sortBy')).toBe('time');
  });

  it('omits the location param when not provided', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({data: []});
    const provider = makeProvider();

    await provider.fetchMatches({date: '20-weeks'});

    const [calledUrl] = mockedAxios.get.mock.calls[0];
    const url = new URL(calledUrl as string);
    expect(url.searchParams.has('location')).toBe(false);
  });

  it('sends an Authorization Bearer header and accept header when a token is configured', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({data: []});
    const provider = makeProvider('https://provider.example.com/v1', 'TEST_TOKEN_123');

    await provider.fetchMatches({date: '20-weeks'});

    const [, opts] = mockedAxios.get.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer TEST_TOKEN_123');
    expect(opts.headers.accept).toBe('application/json');
  });

  it('omits the Authorization header when no token is configured', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({data: []});
    const provider = makeProvider('https://provider.example.com/v1', undefined);

    await provider.fetchMatches({date: '20-weeks'});

    const [, opts] = mockedAxios.get.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('normalizes an array response, mapping color, referee privacy and field name', async () => {
    const payload = [
      {
        id: 'm1',
        date: '2025-11-01T10:40:00.000Z',
        homeTeamName: 'Fortuna/Ruitenheer J1',
        awayTeamName: 'KCC/CK Kozijnen J1',
        accommodation: {name: 'Fortuna-hal', route: 'http://maps'},
        attendanceTime: '2025-11-01T09:40:00.000Z',
        isPracticeMatch: true,
        isHomeMatch: true,
        isCompetitiveMatch: false,
        fieldName: '23b3K24 A - Veld 2b',
        refereeAssignment: {user: {privacy: 'FULL_NAME', fullName: 'John Doe'}},
      },
      {
        id: 'm2',
        date: '2025-11-02T10:40:00.000Z',
        homeTeamName: 'Fortuna/Ruitenheer J14',
        awayTeamName: 'Other',
        isHomeMatch: false,
        refereeAssignment: {user: {privacy: 'FIRST_NAME', fullName: 'Jane Roe'}},
      },
    ];
    mockedAxios.get = vi.fn().mockResolvedValue({data: payload});
    const provider = makeProvider();

    const items = await provider.fetchMatches({date: '2025-11-01'});

    expect(items).toHaveLength(2);
    const m1 = items.find((i) => i.externalId === 'm1')!;
    expect(m1.color).toBe('red'); // J1 => red
    expect(m1.refereeName).toBe('John Doe');
    expect(m1.fieldName).toBe('Veld 2b');
    expect(m1.accommodationName).toBe('Fortuna-hal');
    expect(m1.accommodationRoute).toBe('http://maps');
    expect(m1.attendanceTime).toEqual(new Date('2025-11-01T09:40:00.000Z'));

    const m2 = items.find((i) => i.externalId === 'm2')!;
    expect(m2.color).toBe('green'); // J14 => green
    expect(m2.refereeName).toBe('Jane'); // FIRST_NAME only
  });

  it('masks the referee name when privacy is HIDDEN', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm3',
          date: '2025-11-01T10:00:00.000Z',
          homeTeamName: 'A',
          awayTeamName: 'B',
          refereeAssignment: {user: {privacy: 'HIDDEN', fullName: 'Should Not Appear'}},
        },
      ],
    });
    const provider = makeProvider();

    const items = await provider.fetchMatches({date: '2025-11-01'});

    expect(items[0].refereeName).toBe('Afgeschermd');
  });

  it('falls back to refereeProviderName (filtered of non-referee officials) when no assignment exists', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm4',
          date: '2025-11-01T10:00:00.000Z',
          homeTeamName: 'A',
          awayTeamName: 'B',
          refereeProviderName: 'J. Jansen & K. Klaassen (Schotklokbediener) & L. Lucas (Tijdwaarnemer)',
        },
      ],
    });
    const provider = makeProvider();

    const items = await provider.fetchMatches({date: '2025-11-01'});

    expect(items[0].refereeName).toBe('J. Jansen');
  });

  it('normalizes an object-keyed-by-date response into a flat list', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        '2025-11-01': [
          {id: 'd1', date: '2025-11-01T10:00:00.000Z', homeTeamName: 'A', awayTeamName: 'B', isHomeMatch: true},
        ],
        '2025-11-02': [
          {id: 'd2', date: '2025-11-02T10:00:00.000Z', homeTeamName: 'C', awayTeamName: 'D', isHomeMatch: true},
        ],
      },
    });
    const provider = makeProvider();

    const items = await provider.fetchMatches({date: '20-weeks'});

    expect(items.map((i) => i.externalId).sort()).toEqual(['d1', 'd2']);
  });

  it('skips items without an id', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: [
        {date: '2025-11-01T10:00:00.000Z', homeTeamName: 'A', awayTeamName: 'B'},
        {id: 'ok', date: '2025-11-01T10:00:00.000Z', homeTeamName: 'C', awayTeamName: 'D'},
      ],
    });
    const provider = makeProvider();

    const items = await provider.fetchMatches({date: '2025-11-01'});

    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe('ok');
  });

  it('throws when the provider returns no data', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({data: undefined});
    const provider = makeProvider();

    await expect(provider.fetchMatches({date: '2025-11-01'})).rejects.toThrow(
      'Invalid response format from program API'
    );
  });

  it('propagates network errors from axios', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error('network error'));
    const provider = makeProvider();

    await expect(provider.fetchMatches({date: '2025-11-01'})).rejects.toThrow('network error');
  });
});
