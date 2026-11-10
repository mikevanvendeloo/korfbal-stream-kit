/**
 * Match analysis for the analist: pure functions over the action rows of one match table. Home is always the own team.
 *
 * What the rows tell (verified on the fixture of 31-10-2026):
 * - `opstelling` AANVAL = the own team attacks, VERDEDIGING = the opponent attacks; it changes at every change of
 *   possession (after a goal without a `NAAR ANDER VAK` row), so a possession is a run of actions with one `opstelling`.
 * - `speler` is always an own player (attacking or defending), `tegenstander` the direct opponent.
 * - Codes: 2xxx = minus, 3xxx = plus, both from the own club's view; 4xxx neutral. The score columns stay 0.
 * - `tijdtotaal` is the statistics PC's own clock in seconds (runs on over the rust).
 */
import {isAction, teamNamesOf, type ActionRow} from './matchActions';
import {pct} from './teamStats';

export type Side = 'own' | 'opponent';
export type Split<T> = {total: T; firstHalf: T; secondHalf: T};
export type Ratio = {goals: number; attempts: number; pct: number | null};
export type AttackFigures = {
  attacks: number; withGoal: number; goalPct: number | null;
  attempts: number; attemptsPerAttack: number | null; turnovers: number;
  reboundWon: number; reboundTotal: number; reboundPct: number | null;
};
export type ShotKind = 'afstand' | 'halveAfstand' | 'kort' | 'doorloop';
export type ZoneRow = {kind: ShotKind; zone: string; goals: number; attempts: number; pct: number | null};
export type ShotMap = {byZone: ZoneRow[]; byType: Record<'afstand' | 'kort' | 'doorloop' | 'vrijeBal' | 'strafworp', Ratio>};
export type TurnoverKinds = {steal: number; balOver: number; schotklok: number; onnodigeFout: number; total: number};
export type Score = {own: number; opponent: number};
export type Goal = {t: number; side: Side; own: number; opponent: number; player: string | null};
export type Run = {side: Side; goals: number; from: number; to: number; scoreBefore: Score; scoreAfter: Score};
export type Drought = {seconds: number; from: number; to: number};
export type VakFigures = {vak: 1 | 2; players: string[]; opponents: string[]; attack: Split<AttackFigures>; defence: Split<AttackFigures>};
export type Duel = {vak: 1 | 2 | null; player: string; opponent: string; for: Split<Ratio>; against: Split<Ratio>};

export type MatchAnalysis = {
  teams: {own: string | null; opponent: string | null};
  clock: {lastActionAt: number; half: 1 | 2; halftimeAt: number | null};
  score: Score;
  progression: Goal[];
  runs: Run[];
  droughts: {own: Drought | null; opponent: Drought | null};
  attacks: {own: Split<AttackFigures>; opponent: Split<AttackFigures>};
  vakken: VakFigures[];
  attacksWithoutVak: number;
  duels: Duel[];
  shots: {own: ShotMap; opponent: ShotMap};
  turnovers: {own: Split<TurnoverKinds>; opponent: Split<TurnoverKinds>};
};

const START = 4300, SECOND_HALF = 4400, RUST = 4500, END = 4600;
const SUB_OUT = 5000, SUB_IN = 5001;
const SHOT_TYPES: Record<number, keyof ShotMap['byType']> = {1: 'afstand', 2: 'kort', 3: 'doorloop', 4: 'vrijeBal', 12: 'strafworp'};
const TURNOVER_TYPES: Record<number, Exclude<keyof TurnoverKinds, 'total'>> = {14: 'steal', 21: 'balOver', 15: 'schotklok', 25: 'onnodigeFout'};
/** A run is this many goals in a row by one team */
export const RUN_LENGTH = 3;

const family = (r: ActionRow) => Math.floor(Math.abs(r.aktnummer) / 1000);
const typeOf = (r: ActionRow) => Math.abs(r.aktnummer) % 1000;
const sideOf = (r: ActionRow): Side | null => {
  const o = (r.opstelling ?? '').toUpperCase();
  return o === 'AANVAL' ? 'own' : o === 'VERDEDIGING' ? 'opponent' : null;
};
const name = (v: string | null) => (v && v.trim() ? v.trim() : null);
const isShot = (r: ActionRow) => (family(r) === 2 || family(r) === 3) && typeOf(r) in SHOT_TYPES;
const isGoal = (r: ActionRow) => family(r) === 3 && typeOf(r) in SHOT_TYPES;
const isMarker = (r: ActionRow) => [START, SECOND_HALF, RUST, END].includes(r.aktnummer);
const isSubstitution = (r: ActionRow) => [SUB_OUT, SUB_IN].includes(Math.abs(r.aktnummer));

const ratio = (): Ratio => ({goals: 0, attempts: 0, pct: null});
const attackFigures = (): AttackFigures => ({attacks: 0, withGoal: 0, goalPct: null, attempts: 0, attemptsPerAttack: null, turnovers: 0, reboundWon: 0, reboundTotal: 0, reboundPct: null});
const turnoverKinds = (): TurnoverKinds => ({steal: 0, balOver: 0, schotklok: 0, onnodigeFout: 0, total: 0});
const split = <T>(make: () => T): Split<T> => ({total: make(), firstHalf: make(), secondHalf: make()});
/** The total and the half a moment falls in */
const parts = <T>(s: Split<T>, secondHalf: boolean): T[] => [s.total, secondHalf ? s.secondHalf : s.firstHalf];

function finishRatio(r: Ratio) { r.pct = pct(r.goals, r.attempts); }
function finishAttack(a: AttackFigures) {
  a.goalPct = pct(a.withGoal, a.attacks);
  a.attemptsPerAttack = a.attacks ? Math.round((a.attempts / a.attacks) * 100) / 100 : null;
  a.reboundPct = pct(a.reboundWon, a.reboundTotal);
}
const eachPart = <T>(s: Split<T>, f: (t: T) => void) => [s.total, s.firstHalf, s.secondHalf].forEach(f);

/** Kind and zone of a shot from its description ("HALVE AFSTAND  achter links GOAL"); null for vrije bal and strafworp. */
export function shotZoneOf(r: ActionRow): {kind: ShotKind; zone: string} | null {
  const type = typeOf(r);
  if (type !== 1 && type !== 2 && type !== 3) return null;
  const text = (r.aktieomschrijving ?? '').toUpperCase();
  const prefix = type === 1 ? (text.startsWith('HALVE AFSTAND') ? 'HALVE AFSTAND' : 'AFSTAND SCHOT') : type === 2 ? 'KORT SCHOT' : 'DOORLOOP';
  const kind: ShotKind = type === 1 ? (prefix === 'HALVE AFSTAND' ? 'halveAfstand' : 'afstand') : type === 2 ? 'kort' : 'doorloop';
  if (!text.startsWith(prefix)) return {kind, zone: 'onbekend'};
  const words = text.slice(prefix.length).toLowerCase().split(/\s+/);
  const zone = [words.find((w) => w === 'voor' || w === 'achter'), words.find((w) => w === 'links' || w === 'rechts')].filter(Boolean).join(' ');
  return {kind, zone: zone || 'midden'};
}

/** The longest time without a goal of one side: start → first goal, between goals, last goal → last action. */
function droughtOf(goals: Goal[], side: Side, start: number, last: number): Drought | null {
  if (last <= start) return null;
  const times = [start, ...goals.filter((g) => g.side === side).map((g) => g.t), last];
  let best: Drought | null = null;
  for (let i = 1; i < times.length; i++) {
    const seconds = times[i] - times[i - 1];
    if (!best || seconds > best.seconds) best = {seconds, from: times[i - 1], to: times[i]};
  }
  return best;
}

function runsOf(goals: Goal[]): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < goals.length) {
    let j = i;
    while (j + 1 < goals.length && goals[j + 1].side === goals[i].side) j++;
    const n = j - i + 1;
    if (n >= RUN_LENGTH) {
      const before = i > 0 ? {own: goals[i - 1].own, opponent: goals[i - 1].opponent} : {own: 0, opponent: 0};
      runs.push({side: goals[i].side, goals: n, from: goals[i].t, to: goals[j].t, scoreBefore: before, scoreAfter: {own: goals[j].own, opponent: goals[j].opponent}});
    }
    i = j + 1;
  }
  return runs;
}

/** The whole analysis of one match. */
export function analyseMatch(rows: ActionRow[]): MatchAnalysis {
  const ordered = [...rows].sort((a, b) => a.aktienummer - b.aktienummer);
  const actions = ordered.filter(isAction);

  // Vakken: the lineup rows before the start (definition rows: optelveld 0, aktnummer 0, both names and an
  // opstelling). Rows with aktnummer 0 during the match (optelveld 1) are not a lineup.
  const ownVak = new Map<string, 1 | 2>();
  const oppVak = new Map<string, 1 | 2>();
  const vakPlayers = {1: new Set<string>(), 2: new Set<string>()};
  const vakOpponents = {1: new Set<string>(), 2: new Set<string>()};
  const place = (map: Map<string, 1 | 2>, set: typeof vakPlayers, who: string | null, vak: 1 | 2) => {
    if (!who) return;
    map.set(who, vak);
    set[vak].add(who);
  };
  for (const r of ordered) {
    if (r.aktnummer === START) break;
    if (r.optelveld !== 0 || r.aktnummer !== 0) continue;
    const side = sideOf(r);
    if (!side) continue;
    const vak = side === 'own' ? 1 : 2;
    place(ownVak, vakPlayers, name(r.speler), vak);
    place(oppVak, vakOpponents, name(r.tegenstander), vak);
  }

  const halftimeRow = actions.find((r) => r.aktnummer === RUST);
  const secondHalfRow = actions.find((r) => r.aktnummer === SECOND_HALF);
  const halftimeAt = halftimeRow ? halftimeRow.tijdtotaal : null;
  const start = actions.find((r) => r.aktnummer === START)?.tijdtotaal ?? 0;
  const lastActionAt = actions.reduce((m, r) => Math.max(m, r.tijdtotaal), start);

  const progression: Goal[] = [];
  const score: Score = {own: 0, opponent: 0};
  const attacks = {own: split(attackFigures), opponent: split(attackFigures)};
  const vakFigures = {1: {attack: split(attackFigures), defence: split(attackFigures)}, 2: {attack: split(attackFigures), defence: split(attackFigures)}};
  let attacksWithoutVak = 0;
  const duels = new Map<string, Duel>();
  const zones = {own: new Map<string, ZoneRow>(), opponent: new Map<string, ZoneRow>()};
  const byType = {own: {afstand: ratio(), kort: ratio(), doorloop: ratio(), vrijeBal: ratio(), strafworp: ratio()}, opponent: {afstand: ratio(), kort: ratio(), doorloop: ratio(), vrijeBal: ratio(), strafworp: ratio()}};
  const turnovers = {own: split(turnoverKinds), opponent: split(turnoverKinds)};

  // One possession at a time: closed when the opstelling changes, at a match marker and at the end
  type Possession = {side: Side; secondHalf: boolean; vak: 1 | 2 | null; goal: boolean; attempts: number; reboundWon: number; reboundTotal: number};
  let current: Possession | null = null;
  const close = () => {
    if (!current) return;
    const p = current;
    const add = (a: AttackFigures) => {
      a.attacks += 1;
      if (p.goal) a.withGoal += 1; else a.turnovers += 1;
      a.attempts += p.attempts;
      a.reboundWon += p.reboundWon;
      a.reboundTotal += p.reboundTotal;
    };
    parts(attacks[p.side], p.secondHalf).forEach(add);
    if (p.vak === null) attacksWithoutVak += 1;
    else parts(p.side === 'own' ? vakFigures[p.vak].attack : vakFigures[p.vak].defence, p.secondHalf).forEach(add);
    current = null;
  };

  let secondHalf = false;
  // The vak of the player going off, handed to the player coming on (GEWISSELD is directly followed by INGEVALLEN)
  let pendingVak: 1 | 2 | null = null;
  for (const r of actions) {
    if (isMarker(r)) {
      close();
      if (r.aktnummer === SECOND_HALF) secondHalf = true;
      continue;
    }
    const side = sideOf(r);
    const own = name(r.speler);
    const opp = name(r.tegenstander);

    // A substitute takes the place (and the vak) of the player replaced
    if (isSubstitution(r)) {
      const ownTeam = r.aktnummer > 0;
      const map = ownTeam ? ownVak : oppVak;
      const who = ownTeam ? own : opp;
      if (Math.abs(r.aktnummer) === SUB_OUT) pendingVak = who ? map.get(who) ?? null : null;
      else if (who && pendingVak) place(map, ownTeam ? vakPlayers : vakOpponents, who, pendingVak);
      continue;
    }
    if (!side) continue;

    if (!current || current.side !== side) {
      close();
      current = {side, secondHalf, vak: null, goal: false, attempts: 0, reboundWon: 0, reboundTotal: 0};
    }
    // The own player of the row is in the attack (AANVAL) or the defence (VERDEDIGING) of that vak
    if (current.vak === null && own) current.vak = ownVak.get(own) ?? null;

    const fam = family(r);
    const type = typeOf(r);
    if (isShot(r)) {
      const shooter: Side = side;
      const goal = isGoal(r);
      current.attempts += 1;
      const t = byType[shooter][SHOT_TYPES[type]];
      t.attempts += 1;
      if (goal) t.goals += 1;
      const zone = shotZoneOf(r);
      if (zone) {
        const key = `${zone.kind}|${zone.zone}`;
        let z = zones[shooter].get(key);
        if (!z) zones[shooter].set(key, (z = {...zone, goals: 0, attempts: 0, pct: null}));
        z.attempts += 1;
        if (goal) z.goals += 1;
      }
      // Duel: the own player against the direct opponent of the row
      if (own && opp) {
        const key = `${own}|${opp}`;
        let d = duels.get(key);
        if (!d) duels.set(key, (d = {vak: ownVak.get(own) ?? null, player: own, opponent: opp, for: split(ratio), against: split(ratio)}));
        parts(shooter === 'own' ? d.for : d.against, secondHalf).forEach((x) => { x.attempts += 1; if (goal) x.goals += 1; });
      }
      if (goal) {
        current.goal = true;
        score[shooter] += 1;
        progression.push({t: r.tijdtotaal, side: shooter, own: score.own, opponent: score.opponent, player: shooter === 'own' ? own : opp});
      }
    } else if (type === 8 && (fam === 2 || fam === 3)) {
      // Rebound: + is won by the own team; the attacking side wins it on + in AANVAL and on - in VERDEDIGING
      current.reboundTotal += 1;
      if ((fam === 3) === (side === 'own')) current.reboundWon += 1;
    } else if (type in TURNOVER_TYPES) {
      // Ball lost: own on a minus in AANVAL, opponent on a plus in VERDEDIGING; neutral (4xxx) for the attacking side.
      // A minus in VERDEDIGING or a plus in AANVAL is the defender's action, not a lost ball.
      const loser: Side | null = fam === 4 ? side : fam === 2 && side === 'own' ? 'own' : fam === 3 && side === 'opponent' ? 'opponent' : null;
      if (loser) parts(turnovers[loser], secondHalf).forEach((k) => { k[TURNOVER_TYPES[type]] += 1; k.total += 1; });
    }
  }
  close();

  const allAttack = [attacks.own, attacks.opponent, vakFigures[1].attack, vakFigures[1].defence, vakFigures[2].attack, vakFigures[2].defence];
  allAttack.forEach((s) => eachPart(s, finishAttack));
  const zoneOrder: ShotKind[] = ['afstand', 'halveAfstand', 'kort', 'doorloop'];
  const shotMap = (side: Side): ShotMap => {
    Object.values(byType[side]).forEach(finishRatio);
    const byZone = [...zones[side].values()].map((z) => ({...z, pct: pct(z.goals, z.attempts)}))
      .sort((a, b) => zoneOrder.indexOf(a.kind) - zoneOrder.indexOf(b.kind) || b.attempts - a.attempts || a.zone.localeCompare(b.zone));
    return {byZone, byType: byType[side]};
  };
  const duelList = [...duels.values()].sort((a, b) => (a.vak ?? 3) - (b.vak ?? 3) || a.player.localeCompare(b.player) || a.opponent.localeCompare(b.opponent));
  duelList.forEach((d) => { eachPart(d.for, finishRatio); eachPart(d.against, finishRatio); });

  return {
    teams: teamNamesOf(ordered),
    clock: {lastActionAt, half: secondHalfRow ? 2 : 1, halftimeAt},
    score,
    progression,
    runs: runsOf(progression),
    droughts: {own: droughtOf(progression, 'own', start, lastActionAt), opponent: droughtOf(progression, 'opponent', start, lastActionAt)},
    attacks,
    vakken: ([1, 2] as const).map((vak) => ({vak, players: [...vakPlayers[vak]], opponents: [...vakOpponents[vak]], ...vakFigures[vak]})),
    attacksWithoutVak,
    duels: duelList,
    shots: {own: shotMap('own'), opponent: shotMap('opponent')},
    turnovers,
  };
}
