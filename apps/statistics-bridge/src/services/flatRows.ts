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

export function derivedPlayerRows(players: DerivedPlayer[], names?: {own: string | null; opponent: string | null}) {
  return players.map((p) => ({
    team: p.side === 'own' ? 'home' : 'away',
    teamName: (p.side === 'own' ? names?.own : names?.opponent) ?? null,
    vak: null as number | null,
    name: p.name,
    ...columns(p),
  }));
}

/** The page's players summed over the vakken, as whole-match players (the shape of the database's derived players). */
export function pagePlayersAsDerived(page: TweedeScherm): DerivedPlayer[] {
  const out: DerivedPlayer[] = [];
  const zero = () => ({goals: 0, attempts: 0});
  for (const [side, team] of [['own', page.home], ['opponent', page.away]] as const) {
    const byName = new Map<string, DerivedPlayer>();
    for (const vak of team.vakken) {
      for (const p of vak.players) {
        let sum = byName.get(p.name);
        if (!sum) {
          sum = {side, name: p.name, afstand: zero(), doorloop: zero(), kortSchot: zero(), vrijeBal: zero(), strafworp: zero(), totaal: zero(), rebound: {won: 0, total: 0}, aangeef: 0};
          byName.set(p.name, sum);
        }
        for (const key of ['afstand', 'doorloop', 'kortSchot', 'vrijeBal', 'strafworp', 'totaal'] as const) {
          sum[key].goals += p[key].goals;
          sum[key].attempts += p[key].attempts;
        }
        sum.rebound.won += p.rebound.won;
        sum.rebound.total += p.rebound.total;
        sum.aangeef += p.aangeef;
      }
    }
    out.push(...byName.values());
  }
  return out;
}
