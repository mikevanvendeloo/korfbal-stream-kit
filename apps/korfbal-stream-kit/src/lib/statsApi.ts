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

export type StatsMatch = {table: string; home: string; away: string; date: string | null};
export type DerivedPlayerRow = {
  team: 'home' | 'away'; teamName: string | null; name: string;
  afstand: string; doorloop: string; kortSchot: string; vrijeBal: string; strafworp: string; totaal: string; percentage: number;
  rebound: string; aangeef: number;
};
export type StatsTeamChoice = {value: string; from: 'production' | 'default'};
export type MatchPlayers = {source: 'share' | 'copy'; readAt: string; team: StatsTeamChoice | null; teams: {own: string | null; opponent: string | null}; players: DerivedPlayerRow[]};

export type MatchStatsConfig = {pageUrl: string | null; mdbPath: string | null; keepCopy: boolean; shareHost: string | null};

/** null = not configured, so not tested */
export type StatsCheck = {ok: boolean; ms: number | null} | null;
export type StatsConnection = {host: string | null; network: StatsCheck; file: StatsCheck; page: StatsCheck};

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

export async function setMatchStatsConfig(config: MatchStatsConfig): Promise<MatchStatsConfig> {
  const res = await fetch(createUrl('/api/settings/match-stats'), {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}
