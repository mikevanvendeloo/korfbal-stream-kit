import {describe, expect, it} from 'vitest';
import {InterviewNames, resolveInterviewPlaceholders, shortName, splitInterviewPlaceholders} from './interviewPlaceholders';

const awayMatch: InterviewNames = {
  ownSide: 'AWAY',
  names: {
    HOME: {PLAYER: 'Sanne de Vries', COACH: 'Jan Jansen'},
    AWAY: {PLAYER: 'Kim Bakker', COACH: null},
  },
};

describe('interview placeholders', () => {
  it('replaces thuis/uit placeholders with the selected names', () => {
    expect(resolveInterviewPlaceholders('Interview {speler-thuis} en {speler-uit}', awayMatch))
      .toBe('Interview Sanne de Vries en Kim Bakker');
  });

  it('follows the own club for eigen/tegenstander', () => {
    expect(resolveInterviewPlaceholders('{coach-tegenstander} / {speler-eigen}', awayMatch)).toBe('Jan Jansen / Kim Bakker');
    const homeMatch = {...awayMatch, ownSide: 'HOME' as const};
    expect(resolveInterviewPlaceholders('{coach-tegenstander} / {speler-eigen}', homeMatch)).toBe('coach tegenstander / Sanne de Vries');
  });

  it('supports the short formats', () => {
    expect(resolveInterviewPlaceholders('{speler-thuis:kort}', awayMatch)).toBe('S. de Vries');
    expect(resolveInterviewPlaceholders('{speler-thuis:achternaam}', awayMatch)).toBe('de Vries');
    expect(shortName('Cher', 'kort')).toBe('Cher');
  });

  it('shows a short label when nobody is selected yet, and ignores case', () => {
    expect(splitInterviewPlaceholders('Interview {Coach-Uit}', awayMatch)).toEqual([
      {text: 'Interview ', resolved: null},
      {text: 'coach uit', resolved: false},
    ]);
    expect(resolveInterviewPlaceholders('Interview {coach-thuis}', null)).toBe('Interview coach thuis');
  });

  it('leaves other text and unknown placeholders alone', () => {
    expect(resolveInterviewPlaceholders('Pauze {iets-anders}', awayMatch)).toBe('Pauze {iets-anders}');
    expect(resolveInterviewPlaceholders('', awayMatch)).toBe('');
  });
});

describe('interview placeholders across calls', () => {
  it('resolves every placeholder, also after an earlier match', () => {
    const text = 'Interview {coach-thuis:kort} & {speler-uit}';
    expect(resolveInterviewPlaceholders(text, awayMatch)).toBe('Interview J. Jansen & Kim Bakker');
    expect(resolveInterviewPlaceholders(text, awayMatch)).toBe('Interview J. Jansen & Kim Bakker');
  });
});
