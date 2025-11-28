import { describe, it, expect } from 'vitest';
import { normalizeTeamNameForClubMatch } from './clubs';

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
