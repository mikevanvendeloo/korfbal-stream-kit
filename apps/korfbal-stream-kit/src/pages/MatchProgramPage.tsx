import { useMemo, useState } from 'react';
import { useMatchSchedule, formatDate, nextDayStr, prevDayStr, nextWeekStr, prevWeekStr, LocationFilter } from '../hooks/useMatchSchedule';
import { MatchSchedule, importMatchSchedule } from '../lib/api';

function timeStr(iso: string) {
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function MatchRow({ m }: { m: MatchSchedule }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-gray-200 dark:border-gray-800" role="listitem">
      <div className="flex items-center gap-3">
        <div className="font-mono text-sm text-gray-500 w-14 text-right">{timeStr(m.date)}</div>
        <div className="flex items-center gap-2">
          {m.color && <span aria-label="team-color" className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: m.color || undefined }} />}
          <div className="text-gray-900 dark:text-gray-100 font-medium">{m.homeTeamName}</div>
          <div className="text-gray-400">vs</div>
          <div className="text-gray-900 dark:text-gray-100 font-medium">{m.awayTeamName}</div>
        </div>
      </div>
      <div className="text-sm text-gray-500 flex items-center gap-3">
        {m.fieldName && <span>{m.fieldName}</span>}
        {m.refereeName && <span>Ref: {m.refereeName}</span>}
        {(m.homeScore != null || m.awayScore != null) && (
          <span className="font-mono">{m.homeScore ?? ''} - {m.awayScore ?? ''}</span>
        )}
      </div>
    </div>
  );
}

export default function MatchProgramPage() {
  const today = formatDate(new Date());
  const [date, setDate] = useState<string>(today);
  const [location, setLocation] = useState<LocationFilter>('HOME');
  const { data, isLoading, isError, error, refetch } = useMatchSchedule(date, location);

  const title = useMemo(() => {
    const d = new Date(date + 'T00:00:00Z');
    return d.toUTCString().slice(0, 16);
  }, [date]);

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Match program</h1>
        <div className="flex items-center gap-2">
          <select aria-label="Location filter" value={location} onChange={(e) => setLocation(e.target.value as LocationFilter)} className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1">
            <option value="HOME">Home</option>
            <option value="AWAY">Away</option>
            <option value="ALL">All</option>
          </select>
          <button aria-label="import-default" onClick={async () => { await importMatchSchedule(); await refetch(); }} className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">Import (default)</button>
          <button onClick={() => refetch()} className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100">Refresh</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <button aria-label="prev-week" onClick={() => setDate(prevWeekStr(date))} className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">« Week</button>
          <button aria-label="prev-day" onClick={() => setDate(prevDayStr(date))} className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">‹ Day</button>
        </div>
        <div className="text-lg text-gray-700 dark:text-gray-300" aria-label="date-title">{title}</div>
        <div className="flex items-center gap-2">
          <button aria-label="next-day" onClick={() => setDate(nextDayStr(date))} className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">Day ›</button>
          <button aria-label="next-week" onClick={() => setDate(nextWeekStr(date))} className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">Week »</button>
        </div>
      </div>

      {isLoading && <div role="status">Loading…</div>}
      {isError && <div role="alert">Error: {(error as Error)?.message}</div>}

      <div role="list" className="divide-y divide-gray-200 dark:divide-gray-800 rounded-md bg-white/50 dark:bg-gray-900/50">
        {data?.map((m) => (
          <MatchRow key={m.externalId} m={m} />
        ))}
        {!isLoading && (!data || data.length === 0) && (
          <div className="text-gray-500 py-6 text-center">No matches</div>
        )}
      </div>
    </div>
  );
}
