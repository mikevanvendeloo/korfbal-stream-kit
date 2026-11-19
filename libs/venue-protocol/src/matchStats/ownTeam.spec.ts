import {describe, expect, it} from 'vitest';
import {isOwnTeamTable, ownClubInDefinition, ownTeamNumberInTable} from './ownTeam';
import type {ActionRow} from './matchActions';

const fortuna = ['Fortuna/Ruitenheer', 'Fortuna', 'Fortuna'];
const definition = (speler: string, tegenstander: string): ActionRow[] => [{
  aktienummer: 1, speler, tegenstander, aktieomschrijving: '99902', opstelling: 'PLOEG',
  doelpuntenvoor: 0, doelpuntentegen: 0, tijdtotaal: 0, aktnummer: 8000, optelveld: 0, absoluut: null,
}];

describe('ownTeamNumberInTable', () => {
  it('reads the own club with or without a team number', () => {
    expect(ownTeamNumberInTable('Fortuna DOS46_24_10_2026', fortuna)).toBe(1);
    expect(ownTeamNumberInTable('Fortuna Koog Zaandijk_31_10_2026', fortuna)).toBe(1);
    expect(ownTeamNumberInTable('DVO2 Fortuna2_07_11_2026', fortuna)).toBe(2);
    expect(ownTeamNumberInTable('DVO DOS46_01_11_2026', fortuna)).toBeNull();
  });

  it('keeps the digits of a club name with a number in it', () => {
    const dos = ["DOS'46/VDK Groep", "DOS'46"];
    expect(ownTeamNumberInTable('Fortuna DOS46_24_10_2026', dos)).toBe(1);
    expect(ownTeamNumberInTable('DOS462 KZ2_14_11_2026', dos)).toBe(2);
  });
});

describe('ownClubInDefinition', () => {
  it('needs the own club in speler', () => {
    expect(ownClubInDefinition(definition('Fortuna/Ruitenheer', 'DOS 46/VDK Groep'), fortuna)).toBe(true);
    expect(ownClubInDefinition(definition('DVO/Transus', 'Fortuna/Ruitenheer'), fortuna)).toBe(false);
    expect(ownClubInDefinition(definition('DVO/Transus', 'DOS 46/VDK Groep'), fortuna)).toBe(false);
    expect(ownClubInDefinition([], fortuna)).toBe(false);
  });
});

describe('isOwnTeamTable', () => {
  it('keeps the own team and drops other teams and other clubs', () => {
    expect(isOwnTeamTable('Fortuna DOS46_24_10_2026', 1, fortuna, definition('Fortuna/Ruitenheer', 'DOS 46/VDK Groep'))).toBe(true);
    expect(isOwnTeamTable('DVO2 Fortuna2_07_11_2026', 1, fortuna)).toBe(false);
    expect(isOwnTeamTable('DVO2 Fortuna2_07_11_2026', 2, fortuna, definition('Fortuna/Ruitenheer', 'DVO/Transus'))).toBe(true);
    expect(isOwnTeamTable('DVO DOS46_01_11_2026', 1, fortuna, definition('DVO/Transus', 'DOS 46/VDK Groep'))).toBe(false);
  });
});
