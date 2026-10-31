/** Flat objects for vMix data sources: one row per player, every value a plain string or number. */
import type {Ratio, PlayerStats, TweedeScherm} from './tweedeScherm';
import type {DerivedPlayer} from './matchActions';

const text = (r: Ratio) => `${r.goals}/${r.attempts}`;
const percentage = (r: Ratio) => (r.attempts ? Math.round((r.goals / r.attempts) * 1000) / 10 : 0);

type Stats = Omit<PlayerStats, 'name'>;

function columns(p: Stats) {
  return {
    afstand: text(p.afstand), afstandGoals: p.afstand.goals, afstandAttempts: p.afstand.attempts,
    doorloop: text(p.doorloop), doorloopGoals: p.doorloop.goals, doorloopAttempts: p.doorloop.attempts,
    kortSchot: text(p.kortSchot), kortSchotGoals: p.kortSchot.goals, kortSchotAttempts: p.kortSchot.attempts,
    vrijeBal: text(p.vrijeBal), vrijeBalGoals: p.vrijeBal.goals, vrijeBalAttempts: p.vrijeBal.attempts,
    strafworp: text(p.strafworp), strafworpGoals: p.strafworp.goals, strafworpAttempts: p.strafworp.attempts,
    totaal: text(p.totaal), totaalGoals: p.totaal.goals, totaalAttempts: p.totaal.attempts,
    percentage: percentage(p.totaal),
    rebound: `${p.rebound.won}/${p.rebound.total}`, reboundWon: p.rebound.won, reboundTotal: p.rebound.total,
    aangeef: p.aangeef,
  };
}

export function livePlayerRows(page: TweedeScherm, team: 'home' | 'away', vak?: number) {
  const t = page[team];
  return t.vakken.flatMap((v, i) =>
    vak && vak !== i + 1 ? [] : v.players.map((p) => ({team, teamName: t.name, vak: i + 1, name: p.name, ...columns(p)})),
  );
}

export function derivedPlayerRows(players: DerivedPlayer[]) {
  return players.map((p) => ({team: p.side === 'own' ? 'home' : 'away', name: p.name, ...columns(p)}));
}
