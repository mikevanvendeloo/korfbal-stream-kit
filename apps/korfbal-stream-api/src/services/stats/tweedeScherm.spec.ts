import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {decodeStatsPage, parseTweedeScherm} from './tweedeScherm';

const html = decodeStatsPage(fs.readFileSync(path.join(__dirname, '../../test-fixtures/stats/tweede-scherm.html')));

describe('parseTweedeScherm', () => {
  const page = parseTweedeScherm(html);

  it('reads title, date, score, clock and the teams', () => {
    expect(page.title).toBe('Fortuna/Ruitenheer - KZ/Keukensale.com');
    expect(page.date).toBe('2026-10-31');
    expect(page.clock).toBe('00:55:11');
    expect([page.home.name, page.home.score, page.home.substitutions]).toEqual(['Fortuna/Ruitenheer', 27, 6]);
    expect([page.away.name, page.away.score, page.away.substitutions]).toEqual(['KZ/Keukensale.com', 14, 5]);
  });

  it('splits home and away by colour into two vakken each', () => {
    expect(page.home.vakken).toHaveLength(2);
    expect(page.away.vakken).toHaveLength(2);
    const vak = page.home.vakken[0];
    expect(vak.balls).toBe(44);
    expect(vak.possessionTime).toBe('14:05');
    expect(vak.attemptLabels).toHaveLength(9);
    expect(vak.attemptsEndingInTurnover).toHaveLength(9);
    expect(vak.attemptsEndingInTurnover.slice(0, 2)).toEqual([4, 9]);
    expect(vak.attemptsEndingInGoal.slice(0, 3)).toEqual([0, 7, 4]);
    expect(vak.players).toHaveLength(4);
  });

  it('reads the players', () => {
    const roos = page.home.vakken[0].players[0];
    expect(roos.name).toBe('Roos van Groen');
    expect(roos.afstand).toEqual({goals: 3, attempts: 7});
    expect(roos.doorloop).toEqual({goals: 0, attempts: 1});
    expect(roos.totaal).toEqual({goals: 3, attempts: 8});
    expect(roos.rebound).toEqual({won: 1, total: 1});
    const zoe = page.away.vakken.flatMap((v) => v.players).find((p) => p.name === 'Zoë Engel');
    expect(zoe?.afstand).toEqual({goals: 1, attempts: 13});
    expect(zoe?.strafworp).toEqual({goals: 1, attempts: 1});
  });

  it('reads vak and team totals and percentages', () => {
    expect(page.home.vakken[0].total?.afstand).toEqual({goals: 10, attempts: 67});
    expect(page.home.vakken[0].percentages?.afstand).toBe(14.9);
    expect(page.home.teamTotal?.afstand).toEqual({goals: 19, attempts: 101});
    expect(page.home.teamPercentages?.afstand).toBe(18.8);
  });

  it('refuses a page that is not a statistics page', () => {
    expect(() => parseTweedeScherm('<html><body>Oeps</body></html>')).toThrow();
  });
});

describe('parseTweedeScherm on hostile input', () => {
  it('parses a 500 KB cell of "<" without a closing ">" in linear time', () => {
    const hostile = `<TABLE><TR><TD>${'<'.repeat(500_000)}`;
    const started = Date.now();
    expect(() => parseTweedeScherm(hostile)).toThrow();
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('survives many tags and many cells', () => {
    const started = Date.now();
    expect(() => parseTweedeScherm(`<TR>${'<TD><B></B>'.repeat(40_000)}`)).toThrow();
    expect(Date.now() - started).toBeLessThan(200);
  });
});
