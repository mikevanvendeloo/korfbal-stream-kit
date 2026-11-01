import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {formatTime} from '../lib/time';
import StatsConnectionStatus from '../components/StatsConnectionStatus';
import {useStatsConnection} from '../hooks/useStatsConnection';
import {fetchLiveStats, fetchMatchPlayers, fetchStatsMatches, fetchTeamStats, fetchTopScorers, type PercentageRow, type StatsDatabaseState, type TeamStatsRow, type TopScorerRow, type PlayerStats, type StatsTeam} from '../lib/statsApi';

const POLL_MS = 5000;
const HEAD = ['Speler', 'Afstand', 'Door', 'Kort', 'Vrije bal', 'Straf', 'Totaal', 'Rebound', 'Aangeef'];
const th = 'px-2 py-1 text-left font-medium whitespace-nowrap';
const td = 'px-2 py-1 whitespace-nowrap';
const ratio = (r: {goals: number; attempts: number}) => `${r.goals}/${r.attempts}`;
/** Where the match data came from: the share, the last local copy (with the time it was read) or, without a database, the live page. */
export const sourceLabel = (source: 'share' | 'copy' | 'page', readAt: string, database?: StatsDatabaseState) =>
  source === 'share' ? 'Bron: share'
    : source === 'page' ? `Bron: live pagina (database ${database === 'disabled' ? 'uit' : 'niet bereikbaar'})`
      : `Bron: lokale kopie van ${formatTime(readAt)}`;
/** The team folder of the database: from the active production, or the default 1. */
export const teamLabel = (team: {value: string; from: 'production' | 'default'}) =>
  `Team ${team.value} (${team.from === 'production' ? 'actieve productie' : 'standaard'})`;
const pct = (v: number | null) => (v === null ? '' : `${String(v).replace('.', ',')}%`);

function statCells(p: PlayerStats) {
  return [ratio(p.afstand), ratio(p.doorloop), ratio(p.kortSchot), ratio(p.vrijeBal), ratio(p.strafworp), ratio(p.totaal), `${p.rebound.won}/${p.rebound.total}`, String(p.aangeef)];
}

function pctCells(p: PercentageRow) {
  return [p.afstand, p.doorloop, p.kortSchot, p.vrijeBal, p.strafworp, p.totaal, p.rebound, p.aangeef].map(pct);
}

function Row({label, cells, strong}: {label: string; cells: string[]; strong?: boolean}) {
  return (
    <tr className={strong ? 'font-semibold bg-gray-50 dark:bg-gray-800' : ''}>
      <td className={`${td} max-w-[10rem] truncate`}>{label}</td>
      {cells.map((c, i) => <td key={i} className={`${td} tabular-nums`}>{c}</td>)}
    </tr>
  );
}

function TeamTables({team, accent}: {team: StatsTeam; accent: string}) {
  return (
    <section className="min-w-0" aria-label={team.name}>
      <h2 className={`px-3 py-2 rounded-t-md font-semibold ${accent}`}>
        <span className="truncate block">{team.name}</span>
        <span className="text-xs font-normal">Wissels: {team.substitutions ?? '-'}</span>
      </h2>
      {team.vakken.map((vak, i) => (
        <div key={i} className="mt-3 min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
            Vak {i + 1}{vak.balls !== null && <> · Ballen: {vak.balls}</>}{vak.possessionTime && <> · Tijd: {vak.possessionTime}</>}
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead><tr>{HEAD.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {vak.players.map((p) => <Row key={p.name} label={p.name} cells={statCells(p)}/>)}
                {vak.total && <Row label="Vaktotaal" cells={statCells(vak.total)} strong/>}
                {vak.percentages && <Row label="Vakpercentage" cells={pctCells(vak.percentages)}/>}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {team.teamTotal && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-sm w-full">
            <tbody>
              <Row label="Teamtotaal" cells={statCells(team.teamTotal)} strong/>
              {team.teamPercentages && <Row label="Teampercentage" cells={pctCells(team.teamPercentages)}/>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LiveTab() {
  const {data, error, isLoading} = useQuery({queryKey: ['stats', 'live'], queryFn: fetchLiveStats, refetchInterval: POLL_MS});
  if (isLoading) return <p className="p-4 text-gray-600 dark:text-gray-300">Laden...</p>;
  if (error && !data) return <p role="alert" className="p-4 text-red-700 dark:text-red-300">{(error as Error).message}</p>;
  if (!data) return null;
  return (
    <div className="min-w-0">
      {error && <p role="alert" className="mb-2 text-sm text-orange-700 dark:text-orange-300">Verversen mislukt, laatste stand getoond: {(error as Error).message}</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bron: live pagina</p>
      <p className="text-lg font-semibold mb-3 flex flex-wrap gap-x-4">
        <span>Stand: {data.home.score ?? '-'} - {data.away.score ?? '-'}</span>
        <span>Tijd: {data.clock ?? '-'}</span>
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
        <TeamTables team={data.home} accent="bg-yellow-200 text-gray-900"/>
        <TeamTables team={data.away} accent="bg-red-200 text-gray-900"/>
      </div>
    </div>
  );
}

/** "3/7 (42,9%)": made/attempted with the percentage; a dash without attempts */
const share = (made: number, total: number, percentage: number | null) => (total ? `${made}/${total} (${pct(percentage)})` : '–');
const pctOrDash = (v: number | null) => (v === null ? '–' : pct(v));

function MetricRow({label, home, away}: {label: string; home: string; away: string}) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <th scope="row" className="px-2 py-1 text-left font-medium">{label}</th>
      <td className={`${td} tabular-nums`}>{home}</td>
      <td className={`${td} tabular-nums`}>{away}</td>
    </tr>
  );
}

function SourceLine({row}: {row: {source: 'share' | 'copy' | 'page'; readAt: string; database?: StatsDatabaseState}}) {
  return <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{sourceLabel(row.source, row.readAt, row.database)}</p>;
}

/** The two teams side by side: goal %, rebound %, strafworp %, vrije bal %, afstand, kort, doorloop, man/vrouw, attacks. */
function TeamsTab() {
  const {data, error, isLoading} = useQuery({queryKey: ['stats', 'team-stats'], queryFn: fetchTeamStats, refetchInterval: POLL_MS});
  if (isLoading) return <p className="p-4 text-gray-600 dark:text-gray-300">Laden...</p>;
  if (error && !data) return <p role="alert" className="p-4 text-red-700 dark:text-red-300">Geen statistieken beschikbaar: {(error as Error).message}</p>;
  const home = data?.find((r) => r.team === 'home');
  const away = data?.find((r) => r.team === 'away');
  if (!home || !away) return <p className="p-4 text-gray-600 dark:text-gray-300">Nog geen gegevens.</p>;
  const both = (f: (r: TeamStatsRow) => string) => ({home: f(home), away: f(away)});
  const sexText = (r: TeamStatsRow) => (r.goalsRatio ? `${r.goalsRatio} (${pctOrDash(r.goalsDamesPct)} dames)` : '–');
  return (
    <div className="min-w-0">
      <div className="overflow-x-auto">
        <table className="text-sm w-full" aria-label="Statistieken per team">
          <thead>
            <tr>
              <th className={th}><span className="sr-only">Statistiek</span></th>
              <th className={`${th} max-w-[10rem] truncate`}>{home.teamName ?? 'Thuis'}</th>
              <th className={`${th} max-w-[10rem] truncate`}>{away.teamName ?? 'Uit'}</th>
            </tr>
          </thead>
          <tbody>
            <MetricRow label="Doelpunten / pogingen" {...both((r) => share(r.goals, r.attempts, r.goalPct))}/>
            <MetricRow label="Rebounds" {...both((r) => share(r.reboundWon, r.reboundTotal, r.reboundPct))}/>
            <MetricRow label="Strafworpen" {...both((r) => share(r.strafworpGoals, r.strafworpAttempts, r.strafworpPct))}/>
            <MetricRow label="Vrije ballen" {...both((r) => share(r.vrijeBalGoals, r.vrijeBalAttempts, r.vrijeBalPct))}/>
            <MetricRow label="Afstandsschoten" {...both((r) => share(r.afstandGoals, r.afstandAttempts, r.afstandPct))}/>
            <MetricRow label="Korte schoten" {...both((r) => share(r.kortSchotGoals, r.kortSchotAttempts, r.kortSchotPct))}/>
            <MetricRow label="Doorloopballen" {...both((r) => share(r.doorloopGoals, r.doorloopAttempts, r.doorloopPct))}/>
            <MetricRow label="Doelpunten dames : heren" {...both(sexText)}/>
            <MetricRow label="Aanvallen" {...both((r) => (r.attacks === null ? '–' : String(r.attacks)))}/>
            <MetricRow label="Aanvallen met doelpunt" {...both((r) => (r.attacks === null ? '–' : `${r.attackGoals} (${pctOrDash(r.attackGoalPct)})`))}/>
            <MetricRow label="Balverlies zonder doelpunt" {...both((r) => (r.turnovers === null ? '–' : String(r.turnovers)))}/>
            <MetricRow label="Balverlies zonder schot" {...both((r) => (r.turnoversWithoutAttempt === null ? '–' : String(r.turnoversWithoutAttempt)))}/>
            <MetricRow label="Gemiddeld aantal schoten per aanval" {...both((r) => (r.avgAttemptsPerAttack === null ? '–' : String(r.avgAttemptsPerAttack).replace('.', ',')))}/>
          </tbody>
        </table>
      </div>
      <SourceLine row={home}/>
    </div>
  );
}

function ScorerList({rows, name, accent}: {rows: TopScorerRow[]; name: string; accent: string}) {
  return (
    <section className="min-w-0" aria-label={name}>
      <h2 className={`px-3 py-2 rounded-t-md font-semibold truncate ${accent}`}>{name}</h2>
      {rows.length === 0 ? <p className="px-3 py-2 text-sm text-gray-500">Nog geen doelpunten.</p> : (
        <ol className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r) => (
            <li key={r.rank} className="flex items-baseline gap-2 px-2 py-1.5 min-w-0">
              <span className="w-6 shrink-0 text-right tabular-nums text-gray-500">{r.rank}</span>
              <span className="truncate flex-1">{r.name}</span>
              <span className="font-semibold tabular-nums shrink-0">{r.goals}</span>
              <span className="text-xs tabular-nums text-gray-500 shrink-0">{r.goals}/{r.attempts} ({pctOrDash(r.goalPct)})</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The top scorers of both teams side by side, most goals first. */
function TopScorersTab() {
  const {data, error, isLoading} = useQuery({queryKey: ['stats', 'top-scorers'], queryFn: fetchTopScorers, refetchInterval: POLL_MS});
  if (isLoading) return <p className="p-4 text-gray-600 dark:text-gray-300">Laden...</p>;
  if (error && !data) return <p role="alert" className="p-4 text-red-700 dark:text-red-300">Geen statistieken beschikbaar: {(error as Error).message}</p>;
  if (!data) return null;
  const home = data.filter((r) => r.team === 'home');
  const away = data.filter((r) => r.team === 'away');
  return (
    <div className="min-w-0">
      <div className="grid gap-6 sm:grid-cols-2">
        <ScorerList rows={home} name={home[0]?.teamName ?? 'Thuis'} accent="bg-yellow-200 text-gray-900"/>
        <ScorerList rows={away} name={away[0]?.teamName ?? 'Uit'} accent="bg-red-200 text-gray-900"/>
      </div>
      {data[0] && <SourceLine row={data[0]}/>}
    </div>
  );
}

function MatchTab() {
  const [table, setTable] = useState('');
  const matches = useQuery({queryKey: ['stats', 'matches'], queryFn: fetchStatsMatches});
  const players = useQuery({queryKey: ['stats', 'match-players', table], queryFn: () => fetchMatchPlayers(table), enabled: !!table});
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium mb-1" htmlFor="stats-match">Wedstrijd</label>
      <select id="stats-match" value={table} onChange={(e) => setTable(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900">
        <option value="">Kies een wedstrijd</option>
        {matches.data?.map((m) => <option key={m.table} value={m.table}>{m.date} · {m.home} - {m.away}</option>)}
      </select>
      {matches.error && <p role="alert" className="mt-2 text-red-700 dark:text-red-300">Geen statistieken beschikbaar: {(matches.error as Error).message}</p>}
      {players.error && <p role="alert" className="mt-2 text-red-700 dark:text-red-300">{(players.error as Error).message}</p>}
      {players.data && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{sourceLabel(players.data.source, players.data.readAt, players.data.database)}{players.data.team && <> · {teamLabel(players.data.team)}</>}</p>}
      {players.data && (['home', 'away'] as const).map((side) => {
        const rows = players.data.players.filter((p) => p.team === side);
        const name = side === 'home' ? players.data.teams.own : players.data.teams.opponent;
        return (
          <section key={side} className="mt-4 min-w-0" aria-label={name ?? side}>
            <h2 className="font-semibold mb-1 truncate">{name ?? (side === 'home' ? 'Thuis' : 'Uit')}</h2>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead><tr>{[...HEAD, '%'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((p) => <Row key={p.name} label={p.name} cells={[p.afstand, p.doorloop, p.kortSchot, p.vrijeBal, p.strafworp, p.totaal, p.rebound, String(p.aangeef), pct(p.percentage)]}/>)}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function StatisticsPage() {
  const [tab, setTab] = useState<'live' | 'teams' | 'scorers' | 'match'>('live');
  const connection = useStatsConnection(true);
  // The bridge is its own app: when it is offline there is nothing to show, and the tables would only fail
  const bridgeOffline = connection.data?.bridge.ok === false;
  const tabClass = (active: boolean) => `px-3 py-2 whitespace-nowrap border-b-2 ${active ? 'border-red-600 font-semibold' : 'border-transparent text-gray-600 dark:text-gray-300'}`;
  return (
    <div className="container py-4 min-w-0">
      <h1 className="text-xl font-semibold mb-3">Statistieken</h1>
      <div className="mb-4">
        <StatsConnectionStatus auto/>
      </div>
      {bridgeOffline && <p role="alert" className="p-4 rounded-md border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">De statistics bridge is offline</p>}
      {!bridgeOffline && <>
      <div role="tablist" className="flex gap-2 mb-4 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        <button type="button" role="tab" aria-selected={tab === 'live'} className={tabClass(tab === 'live')} onClick={() => setTab('live')}>Live</button>
        <button type="button" role="tab" aria-selected={tab === 'teams'} className={tabClass(tab === 'teams')} onClick={() => setTab('teams')}>Teamstatistieken</button>
        <button type="button" role="tab" aria-selected={tab === 'scorers'} className={tabClass(tab === 'scorers')} onClick={() => setTab('scorers')}>Topscorers</button>
        <button type="button" role="tab" aria-selected={tab === 'match'} className={tabClass(tab === 'match')} onClick={() => setTab('match')}>Wedstrijd uit database</button>
      </div>
      {tab === 'live' ? <LiveTab/> : tab === 'teams' ? <TeamsTab/> : tab === 'scorers' ? <TopScorersTab/> : <MatchTab/>}
      </>}
    </div>
  );
}
