/**
 * Team statistics and top scorers: pure functions over the derived players of the database or the totals of
 * the statistics page. Flat rows (one per team / per player) so a vMix data source can read them as they are.
 */
import type {DerivedPlayer} from './matchActions';
import type {PlayerStats, StatsTeam as PageTeam} from './tweedeScherm';

type Ratio = {goals: number; attempts: number};
type Counts = {
  afstand: Ratio; doorloop: Ratio; kortSchot: Ratio; vrijeBal: Ratio; strafworp: Ratio; totaal: Ratio;
  rebound: {won: number; total: number};
};

export type Sex = 'dame' | 'heer';

/** Attack figures: only the page has them (the distribution of attempts per ball possession). */
export type AttackStats = {
  /** Ball possessions that ended in a goal or a turnover */
  attacks: number;
  endedInGoal: number;
  /** Possessions that ended in a turnover, so without a goal */
  turnovers: number;
  /** Turnovers without a single attempt */
  turnoversWithoutAttempt: number;
  /** Attempts per possession */
  avgAttemptsPerAttack: number | null;
  /** Share of the possessions that ended in a goal */
  attackGoalPct: number | null;
};

export type TeamStatsRow = {
  team: 'home' | 'away';
  teamName: string | null;
  goals: number;
  attempts: number;
  goalPct: number | null;
  reboundWon: number;
  reboundTotal: number;
  reboundPct: number | null;
  strafworpGoals: number;
  strafworpAttempts: number;
  strafworpPct: number | null;
  vrijeBalGoals: number;
  vrijeBalAttempts: number;
  vrijeBalPct: number | null;
  afstandGoals: number;
  afstandAttempts: number;
  afstandPct: number | null;
  kortSchotGoals: number;
  kortSchotAttempts: number;
  kortSchotPct: number | null;
  doorloopGoals: number;
  doorloopAttempts: number;
  doorloopPct: number | null;
  /** Goals by women / men (needs the player list of the database; null without) */
  goalsDames: number | null;
  goalsHeren: number | null;
  /** Share of the goals scored by women, and the "dames:heren" ratio as text */
  goalsDamesPct: number | null;
  goalsRatio: string | null;
  attacks: number | null;
  attackGoals: number | null;
  turnovers: number | null;
  turnoversWithoutAttempt: number | null;
  avgAttemptsPerAttack: number | null;
  attackGoalPct: number | null;
};

export type TopScorerRow = {
  team: 'home' | 'away';
  teamName: string | null;
  rank: number;
  name: string;
  sex: Sex | null;
  goals: number;
  attempts: number;
  goalPct: number | null;
};

/** One decimal, null without a base (nothing attempted is not 0%). */
export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

const zero = (): Ratio => ({goals: 0, attempts: 0});
const emptyCounts = (): Counts => ({afstand: zero(), doorloop: zero(), kortSchot: zero(), vrijeBal: zero(), strafworp: zero(), totaal: zero(), rebound: {won: 0, total: 0}});

function add(sum: Counts, p: Counts) {
  for (const key of ['afstand', 'doorloop', 'kortSchot', 'vrijeBal', 'strafworp', 'totaal'] as const) {
    sum[key].goals += p[key].goals;
    sum[key].attempts += p[key].attempts;
  }
  sum.rebound.won += p.rebound.won;
  sum.rebound.total += p.rebound.total;
}

/** Attack figures from the page's distributions of attempts per possession, over all vakken. */
export function attackStatsOf(team: PageTeam): AttackStats | null {
  const vakken = team.vakken.filter((v) => v.attemptsEndingInTurnover.length || v.attemptsEndingInGoal.length);
  if (!vakken.length) return null;
  let endedInGoal = 0;
  let turnovers = 0;
  let turnoversWithoutAttempt = 0;
  let attempts = 0;
  for (const v of vakken) {
    // Index n is the number of attempts in the possession ("7+" counted as 7)
    v.attemptsEndingInGoal.forEach((count, n) => { endedInGoal += count; attempts += count * n; });
    v.attemptsEndingInTurnover.forEach((count, n) => { turnovers += count; attempts += count * n; });
    turnoversWithoutAttempt += v.attemptsEndingInTurnover[0] ?? 0;
  }
  const attacks = endedInGoal + turnovers;
  return {
    attacks, endedInGoal, turnovers, turnoversWithoutAttempt,
    avgAttemptsPerAttack: attacks ? Math.round((attempts / attacks) * 100) / 100 : null,
    attackGoalPct: pct(endedInGoal, attacks),
  };
}

function rowOf(team: 'home' | 'away', teamName: string | null, c: Counts, sex: {dames: number; heren: number} | null, attack: AttackStats | null): TeamStatsRow {
  const sexKnown = sex !== null && sex.dames + sex.heren > 0;
  return {
    team, teamName,
    goals: c.totaal.goals, attempts: c.totaal.attempts, goalPct: pct(c.totaal.goals, c.totaal.attempts),
    reboundWon: c.rebound.won, reboundTotal: c.rebound.total, reboundPct: pct(c.rebound.won, c.rebound.total),
    strafworpGoals: c.strafworp.goals, strafworpAttempts: c.strafworp.attempts, strafworpPct: pct(c.strafworp.goals, c.strafworp.attempts),
    vrijeBalGoals: c.vrijeBal.goals, vrijeBalAttempts: c.vrijeBal.attempts, vrijeBalPct: pct(c.vrijeBal.goals, c.vrijeBal.attempts),
    afstandGoals: c.afstand.goals, afstandAttempts: c.afstand.attempts, afstandPct: pct(c.afstand.goals, c.afstand.attempts),
    kortSchotGoals: c.kortSchot.goals, kortSchotAttempts: c.kortSchot.attempts, kortSchotPct: pct(c.kortSchot.goals, c.kortSchot.attempts),
    doorloopGoals: c.doorloop.goals, doorloopAttempts: c.doorloop.attempts, doorloopPct: pct(c.doorloop.goals, c.doorloop.attempts),
    goalsDames: sex ? sex.dames : null,
    goalsHeren: sex ? sex.heren : null,
    goalsDamesPct: sexKnown ? pct(sex.dames, sex.dames + sex.heren) : null,
    goalsRatio: sexKnown ? `${sex.dames}:${sex.heren}` : null,
    attacks: attack?.attacks ?? null,
    attackGoals: attack?.endedInGoal ?? null,
    turnovers: attack?.turnovers ?? null,
    turnoversWithoutAttempt: attack?.turnoversWithoutAttempt ?? null,
    avgAttemptsPerAttack: attack?.avgAttemptsPerAttack ?? null,
    attackGoalPct: attack?.attackGoalPct ?? null,
  };
}

/** The sex of a player: by club and name, else by name alone; null when unknown. */
export type SexLookup = (teamName: string | null, playerName: string) => Sex | null;

/** Team rows from the database's whole-match players. */
export function teamStatsFromPlayers(players: DerivedPlayer[], names: {own: string | null; opponent: string | null}, sexOf: SexLookup | null, attacks: {home: AttackStats | null; away: AttackStats | null}): TeamStatsRow[] {
  return (['home', 'away'] as const).map((team) => {
    const side = team === 'home' ? 'own' : 'opponent';
    const teamName = side === 'own' ? names.own : names.opponent;
    const sum = emptyCounts();
    const bySex = {dames: 0, heren: 0};
    for (const p of players.filter((x) => x.side === side)) {
      add(sum, p);
      const sex = sexOf?.(teamName, p.name);
      if (sex === 'dame') bySex.dames += p.totaal.goals;
      else if (sex === 'heer') bySex.heren += p.totaal.goals;
    }
    return rowOf(team, teamName, sum, sexOf ? bySex : null, attacks[team]);
  });
}

/** Team rows from the page's team totals (all players, also the ones not listed); no sex there. */
export function teamStatsFromPage(home: PageTeam, away: PageTeam): TeamStatsRow[] {
  return ([['home', home], ['away', away]] as const).map(([team, t]) => {
    const total: PlayerStats | null = t.teamTotal;
    const c = emptyCounts();
    if (total) add(c, total);
    return rowOf(team, t.name, c, null, attackStatsOf(t));
  });
}

/** Top scorers per team: most goals first, then fewer attempts (the better percentage), then name. Only players with a goal. */
export function topScorersOf(players: DerivedPlayer[], names: {own: string | null; opponent: string | null}, sexOf: SexLookup | null, limit = 10): TopScorerRow[] {
  return (['home', 'away'] as const).flatMap((team) => {
    const side = team === 'home' ? 'own' : 'opponent';
    const teamName = side === 'own' ? names.own : names.opponent;
    return players
      .filter((p) => p.side === side && p.totaal.goals > 0)
      .sort((a, b) => b.totaal.goals - a.totaal.goals || a.totaal.attempts - b.totaal.attempts || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((p, i) => ({
        team, teamName, rank: i + 1, name: p.name, sex: sexOf?.(teamName, p.name) ?? null,
        goals: p.totaal.goals, attempts: p.totaal.attempts, goalPct: pct(p.totaal.goals, p.totaal.attempts),
      }));
  });
}

/** Sex lookup from the rows of `spelersover` (SPELERSNAAM, SEX = DAME/HEER, vereniging). */
export function sexLookupOf(rows: Record<string, unknown>[]): SexLookup {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const byClub = new Map<string, Sex>();
  const byName = new Map<string, Sex | 'ambiguous'>();
  for (const r of rows) {
    const name = typeof r.SPELERSNAAM === 'string' ? norm(r.SPELERSNAAM) : '';
    const raw = typeof r.SEX === 'string' ? r.SEX.trim().toUpperCase() : '';
    const sex: Sex | null = raw === 'DAME' ? 'dame' : raw === 'HEER' ? 'heer' : null;
    if (!name || !sex) continue;
    const club = typeof r.vereniging === 'string' ? norm(r.vereniging) : '';
    if (club) byClub.set(`${club}|${name}`, sex);
    const seen = byName.get(name);
    byName.set(name, seen === undefined || seen === sex ? sex : 'ambiguous');
  }
  return (teamName, playerName) => {
    const name = norm(playerName);
    const exact = teamName ? byClub.get(`${norm(teamName)}|${name}`) : undefined;
    if (exact) return exact;
    const any = byName.get(name);
    return any === undefined || any === 'ambiguous' ? null : any;
  };
}
