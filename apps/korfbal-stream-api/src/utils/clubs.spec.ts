import { describe, it, expect } from 'vitest';
import { clubAbbreviation, clubMatchKey, clubShortName, findImportClub, normalizeTeamNameForClubMatch } from './clubs';

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

describe('clubMatchKey', () => {
  it('keeps the short name without accents, case, spaces or punctuation', () => {
    expect(clubMatchKey('LDODK/Rinsma Modeplein')).toBe('ldodk');
    expect(clubMatchKey(' Fortuna / Ruitenheer')).toBe('fortuna');
    expect(clubMatchKey("DOS '46")).toBe('dos46');
    expect(clubMatchKey('Kéizer KC')).toBe('keizerkc');
    expect(clubMatchKey('/')).toBe('');
  });
});

describe('findImportClub', () => {
  const clubs = [
    {id: 3, name: 'LDODK/Gaiwiet', shortName: 'LDODK', slug: 'ldodk-gaiwiet'},
    {id: 1, name: 'Fortuna/Ruitenheer', shortName: 'Fortuna', slug: 'fortuna-ruitenheer'},
    {id: 7, name: 'Fortuna/Delta Logistiek', shortName: 'fortuna', slug: 'fortuna-delta-logistiek'},
    {id: 9, name: "DOS '46", shortName: "DOS '46", slug: 'dos-46'},
  ];

  it('takes the club with the lookup slug first', () => {
    expect(findImportClub(clubs, 'fortuna-delta-logistiek', ['Fortuna/Delta Logistiek'])?.id).toBe(7);
  });

  it('finds a club by its short name when the sponsor after the slash changed', () => {
    expect(findImportClub(clubs, 'ldodk-rinsma-modeplein', ['LDODK/Rinsma Modeplein', 'LDODK'])?.id).toBe(3);
    expect(findImportClub(clubs, 'dos46', ['DOS 46'])?.id).toBe(9);
  });

  it('takes the oldest of several clubs with the same short name', () => {
    expect(findImportClub(clubs, 'fortuna-nieuw', ['Fortuna/Nieuw'])?.id).toBe(1);
  });

  it('gives no club for another name or an empty one (a new club)', () => {
    expect(findImportClub(clubs, 'fortuna-54', ["Fortuna '54"])).toBeUndefined();
    expect(findImportClub(clubs, 'club', ['', null])).toBeUndefined();
  });
});
