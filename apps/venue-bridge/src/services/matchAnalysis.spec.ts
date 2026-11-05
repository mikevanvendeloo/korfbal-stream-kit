import {describe, expect, it} from 'vitest';
import {derivePlayerStats, normalizeActionRow, type ActionRow} from './matchActions';
import {analyseMatch, shotZoneOf, type AttackFigures, type Split} from './matchAnalysis';
import {readCsv} from './testCsv';

const rows = readCsv('Fortuna Koog Zaandijk_31_10_2026.csv').map(normalizeActionRow);
const a = analyseMatch(rows);
const players = derivePlayerStats(rows);
const goalsOf = (side: 'own' | 'opponent') => players.filter((p) => p.side === side).reduce((s, p) => s + p.totaal.goals, 0);
const attemptsOf = (side: 'own' | 'opponent') => players.filter((p) => p.side === side).reduce((s, p) => s + p.totaal.attempts, 0);

/** A small synthetic match: action rows in order, `opstelling` A/V. */
let nr = 100;
function act(t: number, aktnummer: number, opstelling: 'A' | 'V' | null, speler: string | null = null, tegenstander: string | null = null, omschrijving: string | null = null): ActionRow {
  return {aktienummer: nr++, speler, tegenstander, aktieomschrijving: omschrijving, opstelling: opstelling === 'A' ? 'AANVAL' : opstelling === 'V' ? 'VERDEDIGING' : null,
    doelpuntenvoor: 0, doelpuntentegen: 0, tijdtotaal: t, aktnummer, optelveld: 1, absoluut: null};
}
const lineup = (speler: string, tegenstander: string, opstelling: 'AANVAL' | 'VERDEDIGING', n: number): ActionRow =>
  ({aktienummer: n, speler, tegenstander, aktieomschrijving: null, opstelling, doelpuntenvoor: 0, doelpuntentegen: 0, tijdtotaal: 0, aktnummer: 0, optelveld: 0, absoluut: null});
const definition: ActionRow = {aktienummer: 1, speler: 'Eigen', tegenstander: 'Gasten', aktieomschrijving: '99901', opstelling: 'PLOEG', doelpuntenvoor: 0, doelpuntentegen: 0, tijdtotaal: 0, aktnummer: 8000, optelveld: 0, absoluut: null};

const addsUp = (s: Split<AttackFigures>) => {
  expect(s.firstHalf.attacks + s.secondHalf.attacks).toBe(s.total.attacks);
  expect(s.firstHalf.withGoal + s.secondHalf.withGoal).toBe(s.total.withGoal);
  expect(s.firstHalf.attempts + s.secondHalf.attempts).toBe(s.total.attempts);
};

describe('analyseMatch on the fixture of 31-10-2026', () => {
  it('derives the score from the goal actions, equal to the player totals', () => {
    expect(a.teams).toEqual({own: 'Fortuna/Ruitenheer', opponent: 'KZ/Keukensale.com'});
    expect(a.score).toEqual({own: goalsOf('own'), opponent: goalsOf('opponent')});
    expect(a.score).toEqual({own: 27, opponent: 14});
    const last = a.progression[a.progression.length - 1];
    expect({own: last.own, opponent: last.opponent}).toEqual(a.score);
  });

  it('knows the halves from RUST and START TWEEDE HELFT', () => {
    expect(a.clock).toEqual({lastActionAt: 3311, half: 2, halftimeAt: 1659});
    addsUp(a.attacks.own);
    addsUp(a.attacks.opponent);
    expect(a.attacks.own.secondHalf.attacks).toBeGreaterThan(0);
  });

  it('finds the runs and the droughts', () => {
    expect(a.runs[0]).toMatchObject({side: 'own', goals: 4, scoreBefore: {own: 0, opponent: 0}, scoreAfter: {own: 4, opponent: 0}});
    expect(a.runs.every((r) => r.goals >= 3)).toBe(true);
    expect(a.droughts.own).toMatchObject({seconds: 579, from: 1217, to: 1796});
    expect(a.droughts.opponent?.seconds).toBeGreaterThan(0);
  });

  it('counts every possession once: one goal at most, attacks ending in a goal equal the goals', () => {
    expect(a.attacks.own.total.withGoal).toBe(a.score.own);
    expect(a.attacks.opponent.total.withGoal).toBe(a.score.opponent);
    expect(a.attacks.own.total.attempts).toBe(attemptsOf('own'));
    expect(a.attacks.opponent.total.attempts).toBe(attemptsOf('opponent'));
    expect(a.attacks.own.total.withGoal + a.attacks.own.total.turnovers).toBe(a.attacks.own.total.attacks);
  });

  it('splits the possessions over the vakken; vakken and possessions without a vak add up to the team', () => {
    const [v1, v2] = a.vakken;
    expect(v1.players.slice(0, 4)).toEqual(['Lindsy Krop', 'Roos van Groen', 'Jordi van Elburg', 'Nik van der Steen']);
    expect(v2.players.slice(0, 4)).toEqual(['Nikki Boerhout', 'Renée van Ginkel', 'Merijn Mensink', 'Wouter Wildschut']);
    expect(v1.players).not.toContain('Renée van Ginkel');
    const ownAttacks = v1.attack.total.attacks + v2.attack.total.attacks;
    const oppAttacks = v1.defence.total.attacks + v2.defence.total.attacks;
    expect(ownAttacks + oppAttacks + a.attacksWithoutVak).toBe(a.attacks.own.total.attacks + a.attacks.opponent.total.attacks);
    [v1.attack, v1.defence, v2.attack, v2.defence].forEach(addsUp);
  });

  it('gives a substitute the vak of the player replaced', () => {
    // Merijn (vak 2) goes off for Jordi, who started in vak 1
    expect(a.vakken[1].players).toContain('Jordi van Elburg');
    expect(a.vakken[0].players).toContain('Laura van der Linden'); // on for Lindsy
  });

  it('gives the duels per pair, adding up to the team attempts', () => {
    const duelFor = a.duels.reduce((s, d) => s + d.for.total.attempts, 0);
    const duelAgainst = a.duels.reduce((s, d) => s + d.against.total.attempts, 0);
    expect(duelFor).toBeLessThanOrEqual(attemptsOf('own'));
    expect(duelAgainst).toBeLessThanOrEqual(attemptsOf('opponent'));
    expect(duelFor).toBeGreaterThan(attemptsOf('own') * 0.9);
    const jordi = a.duels.find((d) => d.player === 'Jordi van Elburg' && d.opponent === 'Marijn van den Goorbergh');
    if (!jordi) throw new Error('duel Jordi - Marijn missing');
    expect(jordi.vak).toBe(1);
    expect(jordi.for.total.attempts).toBe(jordi.for.firstHalf.attempts + jordi.for.secondHalf.attempts);
  });

  it('never drops a shot from the shot map', () => {
    for (const side of ['own', 'opponent'] as const) {
      const map = a.shots[side];
      const zoned = map.byZone.reduce((s, z) => s + z.attempts, 0);
      expect(zoned).toBe(map.byType.afstand.attempts + map.byType.kort.attempts + map.byType.doorloop.attempts);
      const typed = Object.values(map.byType).reduce((s, r) => s + r.attempts, 0);
      expect(typed).toBe(attemptsOf(side));
    }
  });

  it('counts each turnover row once, for the team that lost the ball', () => {
    const own = a.turnovers.own.total;
    const opp = a.turnovers.opponent.total;
    expect(own.total).toBe(own.steal + own.balOver + own.schotklok + own.onnodigeFout);
    expect(a.turnovers.own.firstHalf.total + a.turnovers.own.secondHalf.total).toBe(own.total);
    // A steal by the opponent (STEAL - in AANVAL) is an own turnover; STEAL + in VERDEDIGING is the opponent's
    const stealMinusInAttack = rows.filter((r) => r.optelveld === 1 && r.aktnummer === 2014 && r.opstelling === 'AANVAL').length;
    const stealPlusInDefence = rows.filter((r) => r.optelveld === 1 && r.aktnummer === 3014 && r.opstelling === 'VERDEDIGING').length;
    expect(own.steal).toBe(stealMinusInAttack);
    expect(opp.steal).toBe(stealPlusInDefence);
  });
});

describe('analyseMatch on small matches', () => {
  const base = [definition, lineup('A1', 'T1', 'AANVAL', 2), lineup('B1', 'U1', 'VERDEDIGING', 3)];

  it('has no second half before RUST and a drought from the start for a team without a goal', () => {
    const m = analyseMatch([...base, act(0, 4300, 'A'), act(10, 2001, 'A', 'A1', 'T1', 'AFSTAND SCHOT  voor'), act(20, 3001, 'A', 'A1', 'T1', 'AFSTAND SCHOT voor GOAL'), act(40, 2950, 'V', 'B1', 'U1', 'Pass')]);
    expect(m.clock).toEqual({lastActionAt: 40, half: 1, halftimeAt: null});
    expect(m.attacks.own.secondHalf.attacks).toBe(0);
    expect(m.score).toEqual({own: 1, opponent: 0});
    expect(m.droughts.opponent).toEqual({seconds: 40, from: 0, to: 40});
    expect(m.vakken[0].attack.total).toMatchObject({attacks: 1, withGoal: 1, attempts: 2, attemptsPerAttack: 2, goalPct: 100});
    expect(m.vakken[1].defence.total.attacks).toBe(1);
  });

  it('finds a run of three and none of two', () => {
    const goal = (t: number, o: 'A' | 'V') => [act(t, 3002, o,'A1', 'T1', 'KORT SCHOT GOAL'), act(t + 1, 2950, o === 'A' ? 'V' : 'A', 'B1', 'U1', 'Pass')];
    const m = analyseMatch([...base, act(0, 4300, 'A'), ...goal(10, 'A'), ...goal(20, 'A'), ...goal(30, 'A'), ...goal(40, 'V'), ...goal(50, 'V')]);
    expect(m.runs).toEqual([{side: 'own', goals: 3, from: 10, to: 30, scoreBefore: {own: 0, opponent: 0}, scoreAfter: {own: 3, opponent: 0}}]);
  });

  it('hands the vak of the player going off to the player coming on', () => {
    const m = analyseMatch([...base, act(0, 4300, 'A'), act(5, 5000, 'A', 'A1', 'T1', 'GEWISSELD'), act(5, 5001, 'A', 'A2', 'T1', 'INGEVALLEN'),
      act(6, -5000, 'A', 'A2', 'T1', 'GEWISSELD'), act(6, -5001, 'A', 'A2', 'T2', 'INGEVALLEN'),
      act(10, 2001, 'A', 'A2', 'T2', 'AFSTAND SCHOT')]);
    expect(m.vakken[0].players).toEqual(['A1', 'A2']);
    expect(m.vakken[0].opponents).toEqual(['T1', 'T2']);
    expect(m.vakken[0].attack.total.attacks).toBe(1);
    expect(m.duels).toEqual([expect.objectContaining({vak: 1, player: 'A2', opponent: 'T2'})]);
  });

  it('does not count a defender action as a lost ball', () => {
    const m = analyseMatch([...base, act(0, 4300, 'A'), act(5, 3025, 'A', 'A1', 'T1', 'ONNODIGE FOUT +'), act(6, 2025, 'A', 'A1', 'T1', 'ONNODIGE FOUT -'),
      act(10, 4021, 'V', null, null, 'BAL OVER'), act(12, 2015, 'A', 'A1', 'T1', 'SCHOTKLOK -')]);
    expect(m.turnovers.own.total).toMatchObject({onnodigeFout: 1, schotklok: 1, total: 2});
    expect(m.turnovers.opponent.total).toMatchObject({balOver: 1, total: 1});
  });
});

describe('shotZoneOf', () => {
  const shot = (aktnummer: number, text: string) => ({...act(0, aktnummer, 'A'), aktieomschrijving: text});
  it('reads kind and zone from the description', () => {
    expect(shotZoneOf(shot(3001, 'AFSTAND SCHOT voor rechts GOAL'))).toEqual({kind: 'afstand', zone: 'voor rechts'});
    expect(shotZoneOf(shot(2001, 'HALVE AFSTAND  achter links'))).toEqual({kind: 'halveAfstand', zone: 'achter links'});
    expect(shotZoneOf(shot(2003, 'DOORLOOP'))).toEqual({kind: 'doorloop', zone: 'midden'});
    expect(shotZoneOf(shot(2002, 'KANS'))).toEqual({kind: 'kort', zone: 'onbekend'});
    expect(shotZoneOf(shot(2012, 'STRAFWORP'))).toBeNull();
  });
});
