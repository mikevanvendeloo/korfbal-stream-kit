import {createUrl, extractError} from './api';

export type Ratio = {goals: number; attempts: number};
export type PlayerStats = {
  name: string; afstand: Ratio; doorloop: Ratio; kortSchot: Ratio; vrijeBal: Ratio; strafworp: Ratio; totaal: Ratio;
  rebound: {won: number; total: number}; aangeef: number;
};
export type PercentageRow = Record<'afstand' | 'doorloop' | 'kortSchot' | 'vrijeBal' | 'strafworp' | 'totaal' | 'rebound' | 'aangeef', number | null>;
export type StatsVak = {
  balls: number | null; possessionTime: string | null; players: PlayerStats[]; total: PlayerStats | null; percentages: PercentageRow | null;
};
export type StatsTeam = {
  name: string; score: number | null; substitutions: number | null; vakken: StatsVak[];
  teamTotal: PlayerStats | null; teamPercentages: PercentageRow | null;
};
export type LiveStats = {title: string | null; date: string | null; clock: string | null; home: StatsTeam; away: StatsTeam};

export type StatsMatch = {table: string; home: string; away: string; date: string | null; source?: 'page'};
export type DerivedPlayerRow = {
  team: 'home' | 'away'; teamName: string | null; name: string;
  afstand: string; doorloop: string; kortSchot: string; vrijeBal: string; strafworp: string; totaal: string; percentage: number;
  rebound: string; aangeef: number;
};
export type StatsTeamChoice = {value: string; from: 'production' | 'default'};
/** database: why the page stands in for the database ('disabled': switched off on the bridge, 'unreachable') */
export type StatsDatabaseState = 'disabled' | 'unreachable';
/** One row per team of the current match (flat, as a vMix data source reads it); percentages are null without attempts */
export type TeamStatsRow = {
  team: 'home' | 'away'; teamName: string | null;
  goals: number; attempts: number; goalPct: number | null;
  reboundWon: number; reboundTotal: number; reboundPct: number | null;
  strafworpGoals: number; strafworpAttempts: number; strafworpPct: number | null;
  vrijeBalGoals: number; vrijeBalAttempts: number; vrijeBalPct: number | null;
  afstandGoals: number; afstandAttempts: number; afstandPct: number | null;
  kortSchotGoals: number; kortSchotAttempts: number; kortSchotPct: number | null;
  doorloopGoals: number; doorloopAttempts: number; doorloopPct: number | null;
  goalsDames: number | null; goalsHeren: number | null; goalsDamesPct: number | null; goalsRatio: string | null;
  attacks: number | null; attackGoals: number | null; turnovers: number | null; turnoversWithoutAttempt: number | null;
  avgAttemptsPerAttack: number | null; attackGoalPct: number | null;
  source: 'share' | 'copy' | 'page'; readAt: string; database?: 'disabled' | 'unreachable';
};
export type TopScorerRow = {
  team: 'home' | 'away'; teamName: string | null; rank: number; name: string; sex: 'dame' | 'heer' | null;
  goals: number; attempts: number; goalPct: number | null;
  source: 'share' | 'copy' | 'page'; readAt: string; database?: 'disabled' | 'unreachable';
};

/** The match analysis of the bridge (database only). Times are seconds of the statistics PC's own clock. */
export type AnalysisSide = 'own' | 'opponent';
export type Split<T> = {total: T; firstHalf: T; secondHalf: T};
export type AnalysisRatio = {goals: number; attempts: number; pct: number | null};
export type AttackFigures = {
  attacks: number; withGoal: number; goalPct: number | null; attempts: number; attemptsPerAttack: number | null;
  turnovers: number; reboundWon: number; reboundTotal: number; reboundPct: number | null;
};
export type ShotKind = 'afstand' | 'halveAfstand' | 'kort' | 'doorloop';
export type ShotMap = {
  byZone: Array<{kind: ShotKind; zone: string; goals: number; attempts: number; pct: number | null}>;
  byType: Record<'afstand' | 'kort' | 'doorloop' | 'vrijeBal' | 'strafworp', AnalysisRatio>;
};
export type TurnoverKinds = {steal: number; balOver: number; schotklok: number; onnodigeFout: number; total: number};
export type AnalysisScore = {own: number; opponent: number};
export type MatchAnalysis = {
  teams: {own: string | null; opponent: string | null};
  source: 'share' | 'copy'; readAt: string;
  clock: {lastActionAt: number; half: 1 | 2; halftimeAt: number | null};
  score: AnalysisScore;
  progression: Array<{t: number; side: AnalysisSide; own: number; opponent: number; player: string | null}>;
  runs: Array<{side: AnalysisSide; goals: number; from: number; to: number; scoreBefore: AnalysisScore; scoreAfter: AnalysisScore}>;
  droughts: Record<AnalysisSide, {seconds: number; from: number; to: number} | null>;
  attacks: Record<AnalysisSide, Split<AttackFigures>>;
  vakken: Array<{vak: 1 | 2; players: string[]; opponents: string[]; attack: Split<AttackFigures>; defence: Split<AttackFigures>}>;
  attacksWithoutVak: number;
  duels: Array<{vak: 1 | 2 | null; player: string; opponent: string; for: Split<AnalysisRatio>; against: Split<AnalysisRatio>}>;
  shots: Record<AnalysisSide, ShotMap>;
  turnovers: Record<AnalysisSide, Split<TurnoverKinds>>;
};

export type MatchPlayers ={source: 'share' | 'copy' | 'page'; readAt: string; database?: StatsDatabaseState; team: StatsTeamChoice | null; teams: {own: string | null; opponent: string | null}; players: DerivedPlayerRow[]};

/** The statistics bridge (its own app next to the API); the token is never returned, only whether there is one */
export type MatchStatsConfig = {bridgeUrl: string | null; hasBridgeToken: boolean};
export type MatchStatsInput = {bridgeUrl: string | null; bridgeToken?: string | null};

/** null = not configured, so not tested */
export type StatsCheck = {ok: boolean; ms: number | null} | null;
/** bridge: the bridge itself; the rest is the bridge's own test and only there when the bridge is online */
export type StatsConnection = {
  bridge: {ok: boolean; ms: number | null};
  team?: StatsTeamChoice | null;
  host?: string | null;
  network?: StatsCheck;
  /** 'disabled': the database is switched off on the bridge */
  database?: 'disabled' | StatsCheck;
  page?: StatsCheck;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(createUrl(path));
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export const fetchLiveStats = () => getJson<LiveStats>('/api/stats/live');
export const fetchStatsMatches = () => getJson<StatsMatch[]>('/api/stats/matches');
export const fetchMatchPlayers = (table: string) => getJson<MatchPlayers>(`/api/stats/matches/${encodeURIComponent(table)}/players`);
export const fetchTeamStats = () => getJson<TeamStatsRow[]>('/api/stats/team-stats');
export const fetchTopScorers = () => getJson<TopScorerRow[]>('/api/stats/top-scorers');
export const fetchMatchAnalysis = () => getJson<MatchAnalysis>('/api/stats/analysis');
export const fetchStatsConnection = () =>getJson<StatsConnection>('/api/stats/status');
export const getMatchStatsConfig = () => getJson<MatchStatsConfig>('/api/settings/match-stats');

export async function setMatchStatsConfig(config: MatchStatsInput): Promise<MatchStatsConfig> {
  const res = await fetch(createUrl('/api/settings/match-stats'), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}
