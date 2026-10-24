import { describe, it, expect } from 'vitest';
import { clubAbbreviation, clubShortName, normalizeTeamNameForClubMatch } from './clubs';

describe('normalizeTeamNameForClubMatch', () => {
  it('strips trailing plain numeral squad suffix', () => {
    expect(normalizeTeamNameForClubMatch('Fortuna/Ruitenheer 2')).toBe('Fortuna/Ruitenheer');
    expect(normalizeTeamNameForClubMatch('LDODK 1')).toBe('LDODK');
  });

  it('strips trailing letter+digits squad suffix (A1, B2)', () => {
    expect(normalizeTeamNameForClubMatch('Fortuna A1')).toBe('Fortuna');
    expect(normalizeTeamNameForClubMatch('Dalto B2')).toBe('Dalto');
  });

  it('strips trailing youth prefixes U or J with digits and optional -digits', () => {
    expect(normalizeTeamNameForClubMatch('LDODK/Rinsma Modeplein U19-1')).toBe('LDODK/Rinsma Modeplein');
    expect(normalizeTeamNameForClubMatch('Dalto/Klaverblad J21')).toBe('Dalto/Klaverblad');
    expect(normalizeTeamNameForClubMatch('Fortuna/Ruitenheer u15-3')).toBe('Fortuna/Ruitenheer');
  });

  it('collapses internal whitespace and trims', () => {
    expect(normalizeTeamNameForClubMatch('  Fortuna   /  Ruitenheer   2 ')).toBe('Fortuna / Ruitenheer');
  });
});

describe('clubShortName', () => {
  it('takes the part before the first slash, trimmed', () => {
    expect(clubShortName('Fortuna/Ruitenheer')).toBe('Fortuna');
    expect(clubShortName(' LDODK / Rinsma Modeplein ')).toBe('LDODK');
    expect(clubShortName('A/B/C')).toBe('A');
  });

  it('keeps a name without a slash as it is (trimmed)', () => {
    expect(clubShortName('PKC')).toBe('PKC');
    expect(clubShortName('  De Granaet ')).toBe('De Granaet');
    expect(clubShortName(undefined)).toBe('');
  });
});

describe('clubAbbreviation', () => {
  it('derives up to three uppercase letters/digits from the short name', () => {
    expect(clubAbbreviation('Fortuna')).toBe('FOR');
    expect(clubAbbreviation('Dalto')).toBe('DAL');
    expect(clubAbbreviation("DOS '46")).toBe('DOS');
    expect(clubAbbreviation('KZ/Keukensale.com')).toBe('KZ');
    expect(clubAbbreviation('Koog Zaandijk')).toBe('KZ');
    expect(clubAbbreviation('Fortuna/Ruitenheer')).toBe('FOR');
  });

  it('is null when no letters or digits are left', () => {
    expect(clubAbbreviation('  ')).toBeNull();
    expect(clubAbbreviation("/'")).toBeNull();
  });
});
