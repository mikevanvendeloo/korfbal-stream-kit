import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {formatTime} from '../lib/time';
import {fetchLiveStats, fetchMatchPlayers, fetchStatsMatches, type PercentageRow, type PlayerStats, type StatsTeam} from '../lib/statsApi';

const POLL_MS = 5000;
const HEAD = ['Speler', 'Afstand', 'Door', 'Kort', 'Vrije bal', 'Straf', 'Totaal', 'Rebound', 'Aangeef'];
const th = 'px-2 py-1 text-left font-medium whitespace-nowrap';
const td = 'px-2 py-1 whitespace-nowrap';
const ratio = (r: {goals: number; attempts: number}) => `${r.goals}/${r.attempts}`;
/** Where the match data came from: the share, or the last local copy with the time it was read. */
export const sourceLabel = (source: 'share' | 'copy', readAt: string) =>
  source === 'share' ? 'Bron: share' : `Bron: lokale kopie van ${formatTime(readAt)}`;
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
      {players.data && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{sourceLabel(players.data.source, players.data.readAt)}</p>}
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
  const [tab, setTab] = useState<'live' | 'match'>('live');
  const tabClass = (active: boolean) => `px-3 py-2 border-b-2 ${active ? 'border-red-600 font-semibold' : 'border-transparent text-gray-600 dark:text-gray-300'}`;
  return (
    <div className="container py-4 min-w-0">
      <h1 className="text-xl font-semibold mb-3">Statistieken</h1>
      <div role="tablist" className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-800">
        <button type="button" role="tab" aria-selected={tab === 'live'} className={tabClass(tab === 'live')} onClick={() => setTab('live')}>Live</button>
        <button type="button" role="tab" aria-selected={tab === 'match'} className={tabClass(tab === 'match')} onClick={() => setTab('match')}>Wedstrijd uit database</button>
      </div>
      {tab === 'live' ? <LiveTab/> : <MatchTab/>}
    </div>
  );
}
