import {Link} from 'react-router-dom';
import {MdChevronRight} from 'react-icons/md';
import {Production, useProductions} from '../hooks/useProductions';
import {adminPaths} from '../lib/adminPaths';
import {amsterdamDay, formatDate, formatTime, todayAmsterdam} from '../lib/time';
import StaffingBadge from './StaffingBadge';

type PlannedProduction = Production & { matchSchedule: NonNullable<Production['matchSchedule']> };

const startOf = (p: PlannedProduction) => p.liveTime || p.matchSchedule.date;

/**
 * The productions of the first (Amsterdam) day from today on that has any, earliest first; also today's
 * productions that already started. Empty when nothing is planned from today on.
 */
export function nextProductions(items: Production[], now: Date = new Date()): PlannedProduction[] {
  const today = todayAmsterdam(now);
  const upcoming = items.filter((p): p is PlannedProduction => !!p.matchSchedule && amsterdamDay(p.matchSchedule.date) >= today);
  if (upcoming.length === 0) return [];
  const firstDay = upcoming.map((p) => amsterdamDay(p.matchSchedule.date)).sort()[0];
  return upcoming
    .filter((p) => amsterdamDay(p.matchSchedule.date) === firstDay)
    .sort((a, b) => startOf(a).localeCompare(startOf(b)));
}

/** "vandaag", "morgen" or "zaterdag 31 oktober". */
function dayLabel(date: string, now: Date = new Date()): string {
  const day = amsterdamDay(date);
  if (day === todayAmsterdam(now)) return 'vandaag';
  if (day === todayAmsterdam(new Date(now.getTime() + 24 * 3600_000))) return 'morgen';
  return formatDate(date, {weekday: 'long', day: 'numeric', month: 'long'});
}

/**
 * A card per production of the next day with productions, on the Beheer welcome page. Uses the
 * productions list (active season), so it needs no extra endpoint.
 */
export default function NextProductions() {
  const {data, isLoading} = useProductions();
  if (isLoading) return null;
  const next = nextProductions(data?.items ?? []);

  return (
    <section aria-labelledby="next-productions" className="w-full max-w-3xl mt-8">
      <h2 id="next-productions" className="text-lg font-semibold mb-3">
        Eerstvolgende producties{next.length > 0 && <span className="font-normal text-gray-600 dark:text-gray-400"> — {dayLabel(next[0].matchSchedule.date)}</span>}
      </h2>
      {next.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Er staan geen producties meer gepland. <Link to={adminPaths.productions} className="underline">Alle producties</Link>
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {next.map((p) => (
            <li key={p.id} className="min-w-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-blue-400 dark:hover:border-blue-600">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="tabular-nums" title="Livetijd">{formatTime(startOf(p))}</span>
                {p.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Actief</span>
                )}
              </div>
              <Link to={adminPaths.production(p.id)}
                    className="mt-1 flex items-center gap-1 font-semibold text-gray-900 dark:text-gray-100 hover:underline min-w-0">
                <span className="truncate">{p.matchSchedule.homeTeamName} – {p.matchSchedule.awayTeamName}</span>
                <MdChevronRight className="shrink-0 w-5 h-5" aria-hidden/>
              </Link>
              <div className="mt-2">
                <StaffingBadge productionId={p.id} staffing={p.staffing}/>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
