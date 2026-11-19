import {
  deriveMatchFigures, MATCH_STATS_VERSION, type ActionRow, type AttackFigures, type MatchFigures, type TurnoverKinds,
} from '@korfbal-stream-kit/venue-protocol';
import {prisma} from '../prisma';
import {getActiveSeason} from '../season';
import {requireOrganizationId} from '../organizationContext';
import {hasBridge} from '../venueBridge';
import {resolveStatsTeam} from './statsTeam';
import {seasonStart} from './seasonRange';
import {lastSyncState, syncStatsMatches, type SyncState} from './statsSync';

/** The season overview from the stored matches (see openspec/specs/season-statistics). */

export type SeasonTopScorer = {rank: number; name: string; goals: number; attempts: number; goalPct: number | null; matches: number; strafworpGoals: number};
export type SeasonTeamTotals = {
  matches: number; goals: number; attempts: number; goalPct: number | null;
  attacks: number; withGoal: number; attackGoalPct: number | null; withoutAttempt: number;
  attemptsPerAttack: number | null; byAttempts: number[]; turnovers: TurnoverKinds;
};
export type SeasonVak = {vak: 1 | 2; attacks: number; withGoal: number; withoutAttempt: number; turnovers: number};
export type SeasonMatch = {
  table: string; date: string; ownTeam: string | null; opponent: string | null; score: {own: number; opponent: number};
  attacks: number; withoutAttempt: number; attemptsPerAttack: number | null; attackGoalPct: number | null; turnovers: number;
  vakken: SeasonVak[]; syncedAt: string;
};
export type SeasonOverview = {
  season: {id: number; name: string; from: string};
  team: number;
  /** The team of the active production and every team with kept matches: what "Nu bijwerken" syncs */
  teams: number[];
  database: 'ok' | 'unavailable' | 'offline';
  lastSyncAt: string | null;
  matches: SeasonMatch[];
  topScorers: SeasonTopScorer[];
  totals: {own: SeasonTeamTotals; opponent: SeasonTeamTotals};
};

const wholePct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : null);
const perAttack = (attempts: number, attacks: number) => (attacks > 0 ? Math.round((attempts / attacks) * 100) / 100 : null);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export {seasonStart};

const emptyTotals = (): SeasonTeamTotals => ({
  matches: 0, goals: 0, attempts: 0, goalPct: null, attacks: 0, withGoal: 0, attackGoalPct: null, withoutAttempt: 0,
  attemptsPerAttack: null, byAttempts: [0, 0, 0, 0, 0, 0], turnovers: {steal: 0, balOver: 0, schotklok: 0, onnodigeFout: 0, total: 0},
});

function addAttacks(t: SeasonTeamTotals, a: AttackFigures, turnovers: TurnoverKinds, goals: number) {
  t.matches += 1;
  t.goals += goals;
  t.attempts += a.attempts;
  t.attacks += a.attacks;
  t.withGoal += a.withGoal;
  t.withoutAttempt += a.withoutAttempt ?? 0;
  (a.byAttempts ?? []).forEach((n, i) => { t.byAttempts[i] += n; });
  for (const k of ['steal', 'balOver', 'schotklok', 'onnodigeFout', 'total'] as const) t.turnovers[k] += turnovers[k];
}

function finishTotals(t: SeasonTeamTotals): SeasonTeamTotals {
  return {...t, goalPct: wholePct(t.goals, t.attempts), attackGoalPct: wholePct(t.withGoal, t.attacks), attemptsPerAttack: perAttack(t.attempts, t.attacks)};
}

/** Own players over the matches, most goals first; equal goals and attempts share a rank. */
export function topScorersOf(figures: MatchFigures[]): SeasonTopScorer[] {
  const players = new Map<string, Omit<SeasonTopScorer, 'rank' | 'goalPct'>>();
  for (const f of figures) {
    for (const p of f.players) {
      if (p.side !== 'own' || p.totaal.attempts === 0) continue;
      const row = players.get(p.name) ?? {name: p.name, goals: 0, attempts: 0, matches: 0, strafworpGoals: 0};
      row.goals += p.totaal.goals;
      row.attempts += p.totaal.attempts;
      row.strafworpGoals += p.strafworp.goals;
      row.matches += 1;
      players.set(p.name, row);
    }
  }
  const sorted = [...players.values()].sort((a, b) => b.goals - a.goals || a.attempts - b.attempts || a.name.localeCompare(b.name));
  return sorted.map((p, i) => {
    const firstEqual = sorted.findIndex((q) => q.goals === p.goals && q.attempts === p.attempts);
    return {rank: (firstEqual === -1 ? i : firstEqual) + 1, ...p, goalPct: wholePct(p.goals, p.attempts)};
  });
}

/** The stored figures, derived again from the rows when they come from an older derivation. */
async function figuresOf(m: {id: number; rows: unknown; figures: unknown; derivationVersion: number}): Promise<MatchFigures> {
  if (m.derivationVersion === MATCH_STATS_VERSION) return m.figures as MatchFigures;
  const figures = deriveMatchFigures(m.rows as ActionRow[]);
  await prisma.statsMatch.update({where: {id: m.id}, data: {figures: figures as unknown as object, derivationVersion: MATCH_STATS_VERSION}});
  return figures;
}

export async function seasonOverview(): Promise<SeasonOverview> {
  const orgId = requireOrganizationId('season statistics');
  const [season, team] = await Promise.all([getActiveSeason(), resolveStatsTeam()]);
  const from = seasonStart(season);
  const teamNumber = Number(team.value);
  const stored = await prisma.statsMatch.findMany({
    where: {team: teamNumber, matchDate: {gte: new Date(`${from}T00:00:00.000Z`)}},
    orderBy: [{matchDate: 'desc'}, {tableName: 'asc'}],
    select: {id: true, tableName: true, matchDate: true, ownTeam: true, opponentTeam: true, rows: true, figures: true, derivationVersion: true, syncedAt: true},
  });

  const all: MatchFigures[] = [];
  const own = emptyTotals();
  const opponent = emptyTotals();
  const matches: SeasonMatch[] = [];
  for (const m of stored) {
    const f = await figuresOf(m);
    all.push(f);
    const a = f.analysis;
    const ownAttack = a.attacks.own.total;
    addAttacks(own, ownAttack, a.turnovers.own.total, a.score.own);
    addAttacks(opponent, a.attacks.opponent.total, a.turnovers.opponent.total, a.score.opponent);
    matches.push({
      table: m.tableName, date: isoDate(m.matchDate), ownTeam: m.ownTeam, opponent: m.opponentTeam, score: a.score,
      attacks: ownAttack.attacks, withoutAttempt: ownAttack.withoutAttempt ?? 0, attemptsPerAttack: ownAttack.attemptsPerAttack,
      attackGoalPct: wholePct(ownAttack.withGoal, ownAttack.attacks), turnovers: a.turnovers.own.total.total,
      vakken: a.vakken.map((v) => ({vak: v.vak, attacks: v.attack.total.attacks, withGoal: v.attack.total.withGoal, withoutAttempt: v.attack.total.withoutAttempt ?? 0, turnovers: v.attack.total.turnovers})),
      syncedAt: m.syncedAt.toISOString(),
    });
  }

  const state = lastSyncState(teamNumber);
  return {
    season: {id: season.id, name: season.name, from},
    team: teamNumber,
    teams: await knownTeams(teamNumber),
    database: !hasBridge(orgId) ? 'offline' : state?.database ?? 'unavailable',
    lastSyncAt: state?.at ?? null,
    matches,
    topScorers: topScorersOf(all),
    totals: {own: finishTotals(own), opponent: finishTotals(opponent)},
  };
}

/** The team of the active production and every team with kept matches, ascending. */
export async function knownTeams(activeTeam: number): Promise<number[]> {
  const stored = await prisma.statsMatch.findMany({distinct: ['team'], select: {team: true}});
  return [...new Set([activeTeam, ...stored.map((s) => s.team)])].sort((a, b) => a - b);
}

/**
 * "Nu bijwerken": sync one team, or the active production's team and every team with kept matches, one after the
 * other (each after a running sync). The answer per team: the database state and how many matches were stored.
 */
export async function syncTeamsNow(team?: number): Promise<SyncState[]> {
  const active = Number((await resolveStatsTeam()).value);
  const teams = team !== undefined ? [team] : await knownTeams(active);
  const results: SyncState[] = [];
  for (const t of teams) results.push(await syncStatsMatches({value: String(t), from: t === active ? 'production' : 'default'}));
  return results;
}
