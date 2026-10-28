import {MdBuild, MdGroups, MdLiveTv} from 'react-icons/md';
import type {IconType} from 'react-icons';
import type {DailyOccupancyReport} from '../hooks/useReports';
import {formatTime} from '../lib/time';

type Production = DailyOccupancyReport['productions'][number];

export type DayPlanningEntry = {
  time: string;
  kind: 'opbouw' | 'verzamelen' | 'live';
  label: string;
  match: string | null;
  until: string | null;
};

/** The day's program in time order: opbouw (before the first stream), then per stream verzamelen and live. */
export function dayPlanningEntries(productions: Production[]): DayPlanningEntry[] {
  const entries: DayPlanningEntry[] = [];
  for (const p of productions) {
    const match = `${p.homeTeam} – ${p.awayTeam}`;
    const {setupTime, crewCallTime, liveStart, liveEnd} = p.planning;
    if (setupTime) entries.push({time: setupTime, kind: 'opbouw', label: 'Opbouw', match: null, until: null});
    entries.push({time: crewCallTime, kind: 'verzamelen', label: 'Verzamelen', match, until: null});
    entries.push({time: liveStart, kind: 'live', label: 'Live', match, until: liveEnd});
  }
  return entries.sort((a, b) => a.time.localeCompare(b.time));
}

const ICONS: Record<DayPlanningEntry['kind'], IconType> = {opbouw: MdBuild, verzamelen: MdGroups, live: MdLiveTv};

/** Dagplanning at the top of Rapportages → Dagbezetting (also in its PNG download). */
export default function DayPlanning({productions}: { productions: Production[] }) {
  const entries = dayPlanningEntries(productions);
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="day-planning" className="max-w-xl">
      <h2 id="day-planning" className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Dagplanning</h2>
      <ol className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg">
        {entries.map((entry, i) => {
          const Icon = ICONS[entry.kind];
          return (
            <li key={i} className={`flex items-center gap-3 px-3 py-2 text-sm min-w-0 ${entry.kind === 'live' ? 'font-semibold' : ''}`}>
              <span className="font-mono tabular-nums w-12 shrink-0">{formatTime(entry.time)}</span>
              <Icon className={`shrink-0 ${entry.kind === 'live' ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`} aria-hidden/>
              <span className="w-24 shrink-0">{entry.label}</span>
              {entry.match && <span className="truncate min-w-0">{entry.match}</span>}
              {entry.until && <span className="ml-auto shrink-0 font-normal text-gray-600 dark:text-gray-400">tot {formatTime(entry.until)}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
