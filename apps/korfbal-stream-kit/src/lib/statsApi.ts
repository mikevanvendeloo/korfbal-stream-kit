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
export type MatchPlayers = {source: 'share' | 'copy' | 'page'; readAt: string; database?: StatsDatabaseState; team: StatsTeamChoice | null; teams: {own: string | null; opponent: string | null}; players: DerivedPlayerRow[]};

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
export const fetchStatsConnection = () => getJson<StatsConnection>('/api/stats/status');
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
