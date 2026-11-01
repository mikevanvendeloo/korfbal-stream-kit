import {describe, expect, it} from 'vitest';
import {ownTeamName, withTeam} from './statsTeam';

describe('ownTeamName', () => {
  it('takes the team named in the production team names, ignoring case and spacing', () => {
    expect(ownTeamName('KZ/Keukensale.com', 'fortuna/ruitenheer  2', ['Fortuna/Ruitenheer 2'], ['Fortuna'])).toBe('fortuna/ruitenheer  2');
  });

  it('else the team that starts with the club name', () => {
    expect(ownTeamName('DVO 1', 'Fortuna/Ruitenheer 3', [], ['Fortuna/Ruitenheer'])).toBe('Fortuna/Ruitenheer 3');
    expect(ownTeamName('DVO 1', 'Onbekend 3', [], ['Fortuna'])).toBeNull();
  });
});

describe('withTeam', () => {
  it('replaces only the placeholder, with digits', () => {
    expect(withTeam('F{team}/WEDSTRIJDEN.mdb', {value: '2', from: 'production'})).toBe('F2/WEDSTRIJDEN.mdb');
  });
});
