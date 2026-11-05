import {useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import StatsConnectionStatus from '../components/StatsConnectionStatus';
import {useStatsConnection} from '../hooks/useStatsConnection';
import {fetchMatchAnalysis, type AnalysisRatio, type AnalysisSide, type AttackFigures, type MatchAnalysis, type ShotKind, type Split, type TurnoverKinds} from '../lib/statsApi';
import {sourceLabel} from './StatisticsPage';

const POLL_MS = 15_000;
const th = 'px-2 py-1 text-left font-medium whitespace-nowrap';
const td = 'px-2 py-1 whitespace-nowrap tabular-nums';
type Half = keyof Split<unknown>;

const pct = (v: number | null) => (v === null ? '–' : `${String(v).replace('.', ',')}%`);
const ratioText = (r: AnalysisRatio) => (r.attempts ? `${r.goals}/${r.attempts} (${pct(r.pct)})` : '–');
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
/** A moment on the statistics PC's clock, counted from the start of its half */
export function matchTime(t: number, halftimeAt: number | null): string {
  return halftimeAt !== null && t > halftimeAt ? `2e ${mmss(t - halftimeAt)}` : mmss(t);
}

function Card({title, action, children}: {title: string; action?: ReactNode; children: ReactNode}) {
  return (
    <section className="min-w-0 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Totaal / 1e helft / 2e helft */
function HalfSwitch({value, onChange, label, secondHalf}: {value: Half; onChange: (h: Half) => void; label: string; secondHalf: boolean}) {
  const options: Array<[Half, string]> = [['total', 'Totaal'], ['firstHalf', '1e helft'], ['secondHalf', '2e helft']];
  return (
    <div role="group" aria-label={`Helft ${label}`} className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 text-xs overflow-hidden">
      {options.map(([h, text]) => (
        <button key={h} type="button" aria-pressed={value === h} disabled={h === 'secondHalf' && !secondHalf} onClick={() => onChange(h)}
                className={`px-2 py-1 disabled:opacity-40 ${value === h ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

function useHalf(): [Half, (h: Half) => void] {
  return useState<Half>('total');
}

/** The score of both teams over time, with the rust marked */
function ScoreChart({a, names}: {a: MatchAnalysis; names: Record<AnalysisSide, string>}) {
  const W = 300, H = 110, PAD = 4;
  const end = Math.max(a.clock.lastActionAt, 1);
  const top = Math.max(a.score.own, a.score.opponent, 1);
  const x = (t: number) => PAD + (t / end) * (W - 2 * PAD);
  const y = (n: number) => H - PAD - (n / top) * (H - 2 * PAD);
  const line = (side: AnalysisSide) => {
    let n = 0;
    const points = [`${x(0)},${y(0)}`];
    for (const g of a.progression) {
      if (g.side !== side) continue;
      points.push(`${x(g.t)},${y(n)}`);
      n = g[side];
      points.push(`${x(g.t)},${y(n)}`);
    }
    points.push(`${x(end)},${y(n)}`);
    return points.join(' ');
  };
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
           aria-label={`Verloop van de stand: ${names.own} ${a.score.own}, ${names.opponent} ${a.score.opponent}`}>
        {a.clock.halftimeAt !== null && (
          <line x1={x(a.clock.halftimeAt)} x2={x(a.clock.halftimeAt)} y1={PAD} y2={H - PAD} className="stroke-gray-400" strokeDasharray="3 3"/>
        )}
        <polyline points={line('opponent')} fill="none" className="stroke-red-500" strokeWidth={2}/>
        <polyline points={line('own')} fill="none" className="stroke-amber-500" strokeWidth={2}/>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 text-xs text-gray-600 dark:text-gray-400">
        <span><span className="inline-block w-3 h-0.5 align-middle mr-1 bg-amber-500"/>{names.own}</span>
        <span><span className="inline-block w-3 h-0.5 align-middle mr-1 bg-red-500"/>{names.opponent}</span>
        {a.clock.halftimeAt !== null && <span>Stippellijn: rust</span>}
      </figcaption>
    </figure>
  );
}

function ProgressionCard({a, names}: {a: MatchAnalysis; names: Record<AnalysisSide, string>}) {
  const time = (t: number) => matchTime(t, a.clock.halftimeAt);
  return (
    <Card title="Verloop">
      <p className="text-2xl font-semibold tabular-nums mb-2">{a.score.own} – {a.score.opponent}
        <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">{a.clock.half === 2 ? '2e helft' : '1e helft'}, {time(a.clock.lastActionAt)}</span>
      </p>
      <ScoreChart a={a} names={names}/>
      <h3 className="mt-3 text-sm font-medium">Runs (3 of meer doelpunten op rij)</h3>
      {a.runs.length === 0 ? <p className="text-sm text-gray-500">Nog geen runs.</p> : (
        <ul className="text-sm space-y-0.5">
          {a.runs.map((r) => (
            <li key={`${r.side}-${r.from}`} className="min-w-0">
              <span className="font-medium">{r.goals}–0 {names[r.side]}</span>{' '}
              <span className="text-gray-600 dark:text-gray-400 tabular-nums">{time(r.from)}–{time(r.to)}, {r.scoreBefore.own}-{r.scoreBefore.opponent} → {r.scoreAfter.own}-{r.scoreAfter.opponent}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-3 text-sm font-medium">Langste periode zonder doelpunt</h3>
      <ul className="text-sm space-y-0.5">
        {(['own', 'opponent'] as const).map((side) => {
          const d = a.droughts[side];
          return (
            <li key={side}>
              <span className="font-medium">{names[side]}</span>{' '}
              <span className="tabular-nums text-gray-600 dark:text-gray-400">{d ? `${mmss(d.seconds)} (${time(d.from)}–${time(d.to)})` : '–'}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const ATTACK_ROWS: Array<[string, (f: AttackFigures) => string]> = [
  ['Aanvallen', (f) => String(f.attacks)],
  ['Met doelpunt', (f) => (f.attacks ? `${f.withGoal} (${pct(f.goalPct)})` : '–')],
  ['Schoten per aanval', (f) => (f.attemptsPerAttack === null ? '–' : String(f.attemptsPerAttack).replace('.', ','))],
  ['Balverlies', (f) => String(f.turnovers)],
  ['Rebounds gewonnen', (f) => (f.reboundTotal ? `${f.reboundWon}/${f.reboundTotal} (${pct(f.reboundPct)})` : '–')],
];

function AttackTable({columns, label}: {columns: Array<[string, AttackFigures]>; label: string}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full" aria-label={label}>
        <thead><tr><th className={th}><span className="sr-only">Cijfer</span></th>{columns.map(([h]) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {ATTACK_ROWS.map(([name, f]) => (
            <tr key={name} className="border-t border-gray-100 dark:border-gray-800">
              <th scope="row" className={`${th} font-normal`}>{name}</th>
              {columns.map(([h, fig]) => <td key={h} className={td}>{f(fig)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VakkenCard({a, names}: {a: MatchAnalysis; names: Record<AnalysisSide, string>}) {
  const [half, setHalf] = useHalf();
  return (
    <Card title="Per vak" action={<HalfSwitch value={half} onChange={setHalf} label="per vak" secondHalf={a.clock.half === 2}/>}>
      <div className="space-y-4">
        {a.vakken.map((v) => (
          <div key={v.vak} className="min-w-0">
            <h3 className="text-sm font-medium">Vak {v.vak}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{v.players.join(', ')}</p>
            <AttackTable label={`Vak ${v.vak}`} columns={[[`Aanval ${names.own}`, v.attack[half]], [`Verdediging tegen ${names.opponent}`, v.defence[half]]]}/>
          </div>
        ))}
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Hele ploeg</h3>
          <AttackTable label="Hele ploeg" columns={[[names.own, a.attacks.own[half]], [names.opponent, a.attacks.opponent[half]]]}/>
          {a.attacksWithoutVak > 0 && <p className="text-xs text-gray-500 mt-1">{a.attacksWithoutVak} aanvallen zonder bekend vak (alleen in de ploeg geteld)</p>}
        </div>
      </div>
    </Card>
  );
}

function DuelsCard({a, names}: {a: MatchAnalysis; names: Record<AnalysisSide, string>}) {
  const [half, setHalf] = useHalf();
  const rows = a.duels.filter((d) => d.for[half].attempts + d.against[half].attempts > 0);
  return (
    <Card title="Duels" action={<HalfSwitch value={half} onChange={setHalf} label="duels" secondHalf={a.clock.half === 2}/>}>
      {rows.length === 0 ? <p className="text-sm text-gray-500">Nog geen schoten.</p> : (
        <div className="overflow-x-auto">
          <table className="text-sm w-full" aria-label="Duels">
            <thead>
              <tr>
                <th className={th}>Vak</th>
                <th className={th}>{names.own}</th>
                <th className={th}>Tegenstander</th>
                <th className={th}>Voor</th>
                <th className={th}>Tegen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const net = d.for[half].goals - d.against[half].goals;
                return (
                  <tr key={`${d.player}|${d.opponent}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className={td}>{d.vak ?? '–'}</td>
                    <td className={`${td} max-w-[9rem] truncate`}>{d.player}</td>
                    <td className={`${td} max-w-[9rem] truncate`}>{d.opponent}</td>
                    <td className={`${td} ${net > 0 ? 'text-green-700 dark:text-green-400 font-medium' : ''}`}>{ratioText(d.for[half])}</td>
                    <td className={`${td} ${net < 0 ? 'text-red-700 dark:text-red-400 font-medium' : ''}`}>{ratioText(d.against[half])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">Voor: schoten van de eigen speler; tegen: schoten van de directe tegenstander op deze speler.</p>
    </Card>
  );
}

const KIND_LABEL: Record<ShotKind, string> = {afstand: 'Afstand', halveAfstand: 'Halve afstand', kort: 'Kort', doorloop: 'Doorloop'};
const TYPE_ROWS: Array<[keyof MatchAnalysis['shots']['own']['byType'], string]> = [['afstand', 'Afstand'], ['kort', 'Kort schot'], ['doorloop', 'Doorloop'], ['vrijeBal', 'Vrije bal'], ['strafworp', 'Strafworp']];
const TURNOVER_ROWS: Array<[keyof TurnoverKinds, string]> = [['steal', 'Steal'], ['balOver', 'Bal over'], ['schotklok', 'Schotklok'], ['onnodigeFout', 'Onnodige fout'], ['total', 'Totaal']];

function ShotsCard({a, names}: {a: MatchAnalysis; names: Record<AnalysisSide, string>}) {
  const [side, setSide] = useState<AnalysisSide>('own');
  const [half, setHalf] = useHalf();
  const map = a.shots[side];
  const max = Math.max(1, ...map.byZone.map((z) => z.attempts));
  return (
    <Card title="Schotkaart en balverlies">
      <div role="group" aria-label="Ploeg van de schotkaart" className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 text-xs overflow-hidden mb-2">
        {(['own', 'opponent'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}
                  className={`px-2 py-1 max-w-[10rem] truncate ${side === s ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'text-gray-700 dark:text-gray-300'}`}>
            {names[s]}
          </button>
        ))}
      </div>
      <h3 className="text-sm font-medium">Per zone</h3>
      {map.byZone.length === 0 ? <p className="text-sm text-gray-500">Nog geen schoten.</p> : (
        <ul className="text-sm space-y-1" aria-label={`Schotkaart ${names[side]}`}>
          {map.byZone.map((z) => (
            <li key={`${z.kind}|${z.zone}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 items-center">
              <span className="truncate">{KIND_LABEL[z.kind]} · {z.zone}</span>
              <span className="tabular-nums text-right">{z.goals}/{z.attempts} ({pct(z.pct)})</span>
              <span className="col-span-2 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <span className="block h-full bg-gray-400 dark:bg-gray-600" style={{width: `${(z.attempts / max) * 100}%`}}>
                  <span className="block h-full bg-green-600" style={{width: `${z.attempts ? (z.goals / z.attempts) * 100 : 0}%`}}/>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-3 text-sm font-medium">Per schottype</h3>
      <div className="overflow-x-auto">
        <table className="text-sm w-full" aria-label="Per schottype">
          <thead><tr><th className={th}>Type</th><th className={th}>{names.own}</th><th className={th}>{names.opponent}</th></tr></thead>
          <tbody>
            {TYPE_ROWS.map(([key, label]) => (
              <tr key={key} className="border-t border-gray-100 dark:border-gray-800">
                <th scope="row" className={`${th} font-normal`}>{label}</th>
                <td className={td}>{ratioText(a.shots.own.byType[key])}</td>
                <td className={td}>{ratioText(a.shots.opponent.byType[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Balverlies per soort</h3>
        <HalfSwitch value={half} onChange={setHalf} label="balverlies" secondHalf={a.clock.half === 2}/>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full" aria-label="Balverlies per soort">
          <thead><tr><th className={th}>Soort</th><th className={th}>{names.own}</th><th className={th}>{names.opponent}</th></tr></thead>
          <tbody>
            {TURNOVER_ROWS.map(([key, label]) => (
              <tr key={key} className={`border-t border-gray-100 dark:border-gray-800 ${key === 'total' ? 'font-semibold' : ''}`}>
                <th scope="row" className={`${th} ${key === 'total' ? '' : 'font-normal'}`}>{label}</th>
                <td className={td}>{a.turnovers.own[half][key]}</td>
                <td className={td}>{a.turnovers.opponent[half][key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** LIVE → Analyse: what is happening in the match, for the analist (in the rust). Database only. */
export default function AnalysisPage() {
  const connection = useStatsConnection(true);
  const bridgeOffline = connection.data?.bridge.ok === false;
  const {data, error, isLoading} = useQuery({queryKey: ['stats', 'analysis'], queryFn: fetchMatchAnalysis, refetchInterval: POLL_MS, enabled: !bridgeOffline});
  const names: Record<AnalysisSide, string> = {own: data?.teams.own ?? 'Thuis', opponent: data?.teams.opponent ?? 'Uit'};
  return (
    <div className="container py-4 min-w-0">
      <h1 className="text-xl font-semibold mb-3">Analyse</h1>
      <div className="mb-4">
        <StatsConnectionStatus auto/>
      </div>
      {bridgeOffline ? <p role="alert" className="p-4 rounded-md border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">De venue-bridge is offline</p>
        : isLoading ? <p className="p-4 text-gray-600 dark:text-gray-300">Laden...</p>
          : error && !data ? <p role="alert" className="p-4 text-red-700 dark:text-red-300">{(error as Error).message}</p>
            : data ? (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ProgressionCard a={data} names={names}/>
                  <VakkenCard a={data} names={names}/>
                  <DuelsCard a={data} names={names}/>
                  <ShotsCard a={data} names={names}/>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {sourceLabel(data.source, data.readAt)} · Tijden volgens de statistiek-pc (per helft), niet de zuivere speeltijd van het scorebord
                </p>
              </>
            ) : null}
    </div>
  );
}
