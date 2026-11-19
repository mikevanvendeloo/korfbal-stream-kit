import {useQuery} from '@tanstack/react-query';
import {fetchSeason, type SeasonMatch, type SeasonTeamTotals} from '../lib/statsApi';
import {formatDateTime} from '../lib/time';

const POLL_MS = 60_000;
const th = 'px-2 py-1 text-left font-medium whitespace-nowrap';
const td = 'px-2 py-1 whitespace-nowrap tabular-nums';
const pct = (v: number | null) => (v === null ? '–' : `${v}%`);
const num = (v: number | null) => (v === null ? '–' : String(v).replace('.', ','));
/** `2026-11-14` -> `14-11-2026` (a date without time: no time zone involved) */
const dutchDate = (iso: string) => iso.split('-').reverse().join('-');

const NOT_UPDATED: Record<'unavailable' | 'offline', string> = {
  unavailable: 'Wedstrijden worden niet bijgewerkt: het statistiekenbestand is niet bereikbaar.',
  offline: 'Wedstrijden worden niet bijgewerkt: de venue-bridge is offline.',
};

function TotalsRow({label, own, opponent}: {label: string; own: string; opponent: string}) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <th scope="row" className="px-2 py-1 text-left font-medium">{label}</th>
      <td className={td}>{own}</td>
      <td className={td}>{opponent}</td>
    </tr>
  );
}

function Totals({own, opponent}: {own: SeasonTeamTotals; opponent: SeasonTeamTotals}) {
  const both = (f: (t: SeasonTeamTotals) => string) => ({own: f(own), opponent: f(opponent)});
  const spread = (t: SeasonTeamTotals) => t.byAttempts.map((n, i) => `${i === 5 ? '5+' : i}: ${n}`).join(' · ');
  return (
    <section className="min-w-0" aria-label="Teamcijfers seizoen">
      <h2 className="font-semibold mb-1">Teamcijfers</h2>
      <div className="overflow-x-auto">
        <table className="text-sm w-full" aria-label="Teamcijfers seizoen">
          <thead>
            <tr>
              <th className={th}><span className="sr-only">Cijfer</span></th>
              <th className={th}>Eigen team</th>
              <th className={th}>Tegenstanders</th>
            </tr>
          </thead>
          <tbody>
            <TotalsRow label="Doelpunten / pogingen" {...both((t) => `${t.goals}/${t.attempts} (${pct(t.goalPct)})`)}/>
            <TotalsRow label="Aanvallen" {...both((t) => String(t.attacks))}/>
            <TotalsRow label="Aanvallen met doelpunt" {...both((t) => `${t.withGoal} (${pct(t.attackGoalPct)})`)}/>
            <TotalsRow label="Aanvallen zonder schot" {...both((t) => String(t.withoutAttempt))}/>
            <TotalsRow label="Schoten per aanval" {...both((t) => num(t.attemptsPerAttack))}/>
            <TotalsRow label="Aanvallen per aantal schoten" {...both(spread)}/>
            <TotalsRow label="Balverlies" {...both((t) => `${t.turnovers.total} (steal ${t.turnovers.steal}, bal over ${t.turnovers.balOver}, schotklok ${t.turnovers.schotklok}, onnodige fout ${t.turnovers.onnodigeFout})`)}/>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function vakText(m: SeasonMatch, vak: 1 | 2) {
  const v = m.vakken.find((x) => x.vak === vak);
  return v ? `${v.attacks} / ${v.turnovers} / ${v.withoutAttempt}` : '–';
}

function Matches({matches}: {matches: SeasonMatch[]}) {
  return (
    <section className="min-w-0" aria-label="Wedstrijden seizoen">
      <h2 className="font-semibold mb-1">Gebaseerd op {matches.length === 1 ? '1 wedstrijd' : `${matches.length} wedstrijden`}</h2>
      <div className="overflow-x-auto">
        <table className="text-sm w-full" aria-label="Wedstrijden seizoen">
          <thead>
            <tr>
              <th className={th}>Datum</th>
              <th className={th}>Tegenstander</th>
              <th className={th}>Uitslag</th>
              <th className={th}>Aanvallen</th>
              <th className={th}>Zonder schot</th>
              <th className={th}>Schoten/aanval</th>
              <th className={th}>Met doelpunt</th>
              <th className={th}>Balverlies</th>
              <th className={th} title="Aanvallen / zonder doelpunt / zonder schot">Vak 1</th>
              <th className={th} title="Aanvallen / zonder doelpunt / zonder schot">Vak 2</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.table} className="border-t border-gray-100 dark:border-gray-800">
                <td className={td}>{dutchDate(m.date)}</td>
                <td className="px-2 py-1 max-w-[12rem] truncate">{m.opponent ?? m.table}</td>
                <td className={td}>{m.score.own}–{m.score.opponent}</td>
                <td className={td}>{m.attacks}</td>
                <td className={td}>{m.withoutAttempt}</td>
                <td className={td}>{num(m.attemptsPerAttack)}</td>
                <td className={td}>{pct(m.attackGoalPct)}</td>
                <td className={td}>{m.turnovers}</td>
                <td className={td}>{vakText(m, 1)}</td>
                <td className={td}>{vakText(m, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Per vak: aanvallen / zonder doelpunt / zonder schot.</p>
    </section>
  );
}

/**
 * The season of the own team from the matches the API keeps (also without the bridge or the statistics file):
 * top scorers, team figures and the matches they are based on.
 */
export default function SeasonStats() {
  const {data, error, isLoading} = useQuery({queryKey: ['stats', 'season'], queryFn: fetchSeason, refetchInterval: POLL_MS});
  if (isLoading) return <p className="p-4 text-gray-600 dark:text-gray-300">Laden...</p>;
  if (error && !data) return <p role="alert" className="p-4 text-red-700 dark:text-red-300">Geen seizoensstatistieken beschikbaar: {(error as Error).message}</p>;
  if (!data) return null;
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Seizoen {data.season.name}, vanaf {dutchDate(data.season.from)}, team {data.team}
          {data.lastSyncAt && <> · bijgewerkt {formatDateTime(data.lastSyncAt)}</>}
        </p>
        {data.database !== 'ok' && (
          <p role="status" className="mt-2 p-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200">
            {NOT_UPDATED[data.database]}
          </p>
        )}
      </div>
      {data.matches.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300">Nog geen wedstrijden van dit seizoen bewaard.</p>
      ) : (
        <>
          <section className="min-w-0" aria-label="Topscorers seizoen">
            <h2 className="font-semibold mb-1">Topscorers eigen club</h2>
            <ol className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.topScorers.map((p) => (
                <li key={p.name} className="flex items-baseline gap-2 px-2 py-1.5 min-w-0">
                  <span className="w-6 shrink-0 text-right tabular-nums text-gray-500">{p.rank}</span>
                  <span className="truncate flex-1">{p.name}</span>
                  <span className="font-semibold tabular-nums shrink-0">{p.goals}</span>
                  <span className="text-xs tabular-nums text-gray-500 shrink-0">{p.goals}/{p.attempts} ({pct(p.goalPct)}) · {p.matches} wedstr.</span>
                </li>
              ))}
            </ol>
          </section>
          <Totals own={data.totals.own} opponent={data.totals.opponent}/>
          <Matches matches={data.matches}/>
        </>
      )}
    </div>
  );
}
