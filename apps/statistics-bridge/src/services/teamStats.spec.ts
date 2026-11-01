import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {derivePlayerStats, normalizeActionRow, teamNamesOf} from './matchActions';
import {attackStatsOf, pct, sexLookupOf, teamStatsFromPage, teamStatsFromPlayers, topScorersOf} from './teamStats';
import {readCsv} from './testCsv';
import {decodeStatsPage, parseTweedeScherm} from './tweedeScherm';

const rows = readCsv('Fortuna Koog Zaandijk_31_10_2026.csv').map(normalizeActionRow);
const players = derivePlayerStats(rows);
const names = teamNamesOf(rows);
const sexOf = sexLookupOf(readCsv('spelersover.csv'));
const page = parseTweedeScherm(decodeStatsPage(fs.readFileSync(path.join(__dirname, '../test-fixtures/stats/tweede-scherm.html'))));

describe('pct', () => {
  it('rounds to one decimal and has no value without a base', () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(0, 5)).toBe(0);
    expect(pct(0, 0)).toBeNull();
  });
});

describe('teamStatsFromPlayers', () => {
  const [home, away] = teamStatsFromPlayers(players, names, sexOf, {home: null, away: null});

  it('sums the shot categories per team and gives the percentages', () => {
    const own = players.filter((p) => p.side === 'own');
    expect(home.team).toBe('home');
    expect(home.teamName).toBe('Fortuna/Ruitenheer');
    expect(home.goals).toBe(own.reduce((s, p) => s + p.totaal.goals, 0));
    expect(home.afstandGoals).toBe(own.reduce((s, p) => s + p.afstand.goals, 0));
    expect(home.goalPct).toBe(pct(home.goals, home.attempts));
    expect(home.afstandPct).toBe(pct(home.afstandGoals, home.afstandAttempts));
    expect(home.reboundPct).toBe(pct(home.reboundWon, home.reboundTotal));
    expect(away.teamName).toBe('KZ/Keukensale.com');
    expect(away.goals).toBeGreaterThan(0);
  });

  it('splits the goals by women and men from spelersover', () => {
    expect((home.goalsDames ?? 0) + (home.goalsHeren ?? 0)).toBeLessThanOrEqual(home.goals);
    expect(home.goalsDames).toBeGreaterThan(0);
    expect(home.goalsRatio).toBe(`${home.goalsDames}:${home.goalsHeren}`);
    expect(home.goalsDamesPct).toBe(pct(home.goalsDames ?? 0, (home.goalsDames ?? 0) + (home.goalsHeren ?? 0)));
  });

  it('has no sex figures without the player list, and no attack figures without the page', () => {
    const [h] = teamStatsFromPlayers(players, names, null, {home: null, away: null});
    expect(h.goalsDames).toBeNull();
    expect(h.goalsRatio).toBeNull();
    expect(h.attacks).toBeNull();
  });
});

describe('teamStatsFromPage', () => {
  const [home, away] = teamStatsFromPage(page.home, page.away);

  it('takes the team totals of the page', () => {
    expect(home.afstandGoals).toBe(page.home.teamTotal?.afstand.goals);
    expect(home.afstandAttempts).toBe(page.home.teamTotal?.afstand.attempts);
    expect(home.afstandPct).toBe(pct(19, 101));
    expect(away.teamName).toBe('KZ/Keukensale.com');
    expect(home.goalsDames).toBeNull();
  });

  it('adds the attack figures from the attempts per possession', () => {
    // Fortuna: goals and turnovers per number of attempts, both vakken
    const attack = attackStatsOf(page.home);
    expect(attack?.endedInGoal).toBe(14 + 13);
    expect(attack?.turnovers).toBe(29 + 17);
    expect(attack?.attacks).toBe(14 + 13 + 29 + 17);
    expect(attack?.turnoversWithoutAttempt).toBe(4 + 3);
    // Attempts in the possessions equal the team's attempts on the page
    expect((attack?.avgAttemptsPerAttack ?? 0) * (attack?.attacks ?? 0)).toBeCloseTo(75 + 46, 0);
    expect(home.attackGoalPct).toBe(pct(27, 73));
    expect(home.turnovers).toBe(46);
  });
});

describe('topScorersOf', () => {
  const scorers = topScorersOf(players, names, sexOf);

  it('lists the players of each team with a goal, most goals first, with a rank', () => {
    for (const team of ['home', 'away'] as const) {
      const list = scorers.filter((s) => s.team === team);
      expect(list.length).toBeGreaterThan(0);
      expect(list.map((s) => s.rank)).toEqual(list.map((_, i) => i + 1));
      expect(list.map((s) => s.goals)).toEqual([...list.map((s) => s.goals)].sort((a, b) => b - a));
      expect(list.every((s) => s.goals > 0)).toBe(true);
    }
  });

  it('keeps the best percentage first among equal goals and knows the sex', () => {
    const mk = (name: string, goals: number, attempts: number) => ({side: 'own' as const, name, afstand: {goals: 0, attempts: 0}, doorloop: {goals: 0, attempts: 0}, kortSchot: {goals: 0, attempts: 0}, vrijeBal: {goals: 0, attempts: 0}, strafworp: {goals: 0, attempts: 0}, totaal: {goals, attempts}, rebound: {won: 0, total: 0}, aangeef: 0});
    const list = topScorersOf([mk('B', 3, 10), mk('A', 3, 6), mk('C', 5, 20), mk('Zero', 0, 4)], {own: 'X', opponent: 'Y'}, null);
    expect(list.map((s) => s.name)).toEqual(['C', 'A', 'B']);
    expect(list[1].goalPct).toBe(50);
    expect(sexOf('Fortuna/Ruitenheer', 'Roos van Groen')).toBe('dame');
  });

  it('limits the list per team', () => {
    expect(topScorersOf(players, names, null, 2).filter((s) => s.team === 'home')).toHaveLength(2);
  });
});

describe('sexLookupOf', () => {
  it('prefers the club, falls back to the name and ignores an ambiguous name', () => {
    const lookup = sexLookupOf([
      {SPELERSNAAM: 'Sam Bakker', SEX: 'DAME', vereniging: 'Club A'},
      {SPELERSNAAM: 'Sam Bakker', SEX: 'HEER', vereniging: 'Club B'},
      {SPELERSNAAM: 'Unieke Naam', SEX: 'HEER', vereniging: 'Club A'},
      {SPELERSNAAM: 'Scheids', SEX: 'Scheidsrechter', vereniging: ''},
    ]);
    expect(lookup('Club A', 'sam  bakker')).toBe('dame');
    expect(lookup('Club B', 'Sam Bakker')).toBe('heer');
    expect(lookup(null, 'Sam Bakker')).toBeNull();
    expect(lookup('Andere club', 'Unieke Naam')).toBe('heer');
    expect(lookup('Club A', 'Scheids')).toBeNull();
  });
});
