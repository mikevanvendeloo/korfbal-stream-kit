import {describe, expect, it} from 'vitest';
import {buildVmixMatchInfo} from './vmixMatchInfo';

const base = 'http://10.0.0.5:3333/uploads';

describe('buildVmixMatchInfo', () => {
  it('gives every match field as text, with times in Amsterdam time and images as full URLs', () => {
    const info = buildVmixMatchInfo({
      productionId: 7,
      liveTime: new Date('2026-10-17T17:55:00.000Z'),
      match: {
        date: new Date('2026-10-17T18:00:00.000Z'), homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'PKC 1',
        attendanceTime: new Date('2026-10-17T17:00:00.000Z'), accommodationName: 'Fortuna Hal', fieldName: 'Veld 1',
        refereeName: 'J. de Vries', reserveRefereeName: 'P. Bakker', description: 'Korfbal League',
        homeScore: 24, awayScore: 22, season: {name: '2026/2027'},
      },
      homeClub: {shortName: 'Fortuna', abbreviation: 'FOR', logoUrl: 'clubs/fortuna.png'},
      awayClub: {shortName: 'PKC', logoUrl: 'https://cdn.example.org/pkc.png'},
      matchSponsor: {name: 'Bakkerij Jansen', logoPath: 'sponsors/bakkerij-jansen.png'},
      ballSponsor: {name: 'Vrije tekst', logoPath: null},
    }, base);

    expect(info).toEqual({
      productionId: '7',
      home: 'Fortuna/Ruitenheer 1', away: 'PKC 1', match: 'Fortuna/Ruitenheer 1 - PKC 1',
      homeShort: 'Fortuna', awayShort: 'PKC', homeAbbreviation: 'FOR', awayAbbreviation: '',
      homeLogo: 'http://10.0.0.5:3333/uploads/clubs/fortuna.png',
      awayLogo: 'https://cdn.example.org/pkc.png',
      date: 'zaterdag 17 oktober 2026', dateShort: '17-10-2026',
      kickoff: '20:00', attendanceTime: '19:00', liveStart: '19:55',
      accommodation: 'Fortuna Hal', field: 'Veld 1',
      referee: 'J. de Vries', reserveReferee: 'P. Bakker', referees: 'J. de Vries & P. Bakker',
      description: 'Korfbal League', season: '2026/2027',
      homeScore: '24', awayScore: '22', score: '24 - 22',
      matchSponsor: 'Bakkerij Jansen', matchSponsorLogo: 'http://10.0.0.5:3333/uploads/sponsors/bakkerij-jansen.png',
      ballSponsor: 'Vrije tekst', ballSponsorLogo: '',
    });
  });

  it('keeps unknown fields empty and has an all-empty row without an active production', () => {
    const empty = buildVmixMatchInfo(null, base);
    expect(Object.values(empty).every((v) => v === '')).toBe(true);

    const partial = buildVmixMatchInfo({
      productionId: 1, liveTime: null,
      match: {
        date: new Date('2026-10-17T18:00:00.000Z'), homeTeamName: 'A', awayTeamName: 'B', attendanceTime: null,
        accommodationName: null, fieldName: null, refereeName: 'J. de Vries', reserveRefereeName: null, description: null,
        homeScore: null, awayScore: null,
      },
    }, base);
    expect(partial).toMatchObject({referees: 'J. de Vries', score: '', liveStart: '', homeLogo: '', season: ''});
  });
});
