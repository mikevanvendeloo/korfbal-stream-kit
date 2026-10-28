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
  // A real table (not fixed widths): the columns grow with the text, also in the larger PNG export
  return (
    <section aria-labelledby="day-planning" className="day-planning-section max-w-xl">
      <h2 id="day-planning" className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Dagplanning</h2>
      <table className="day-planning w-full border border-gray-200 dark:border-gray-800 text-sm">
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry, i) => {
            const Icon = ICONS[entry.kind];
            const live = entry.kind === 'live';
            return (
              <tr key={i} className={live ? 'font-semibold' : ''}>
                <td className="py-2 pl-3 pr-2 align-middle font-mono tabular-nums whitespace-nowrap">{formatTime(entry.time)}</td>
                <td className="py-2 px-1 align-middle w-0">
                  <Icon className={`block h-[1.1em] w-[1.1em] ${live ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`} aria-hidden/>
                </td>
                <td className="py-2 px-2 align-middle whitespace-nowrap">{entry.label}</td>
                <td className="py-2 px-2 align-middle">{entry.match ?? ''}</td>
                <td className="py-2 pl-2 pr-3 align-middle whitespace-nowrap text-right font-normal text-gray-600 dark:text-gray-400">
                  {entry.until ? `tot ${formatTime(entry.until)}` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
