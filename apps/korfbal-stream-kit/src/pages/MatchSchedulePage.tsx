import * as React from 'react';
import {useMemo, useState} from 'react';
import {
  LocationFilter,
  nextDayStr,
  nextWeekStr,
  prevDayStr,
  prevWeekStr,
  useMatchSchedule,
} from '../hooks/useMatchSchedule';
import {MatchSchedule} from '../lib/api';
import {formatDate as formatAmsterdamDate, formatTime, todayAmsterdam} from '../lib/time';
import MatchImportForm from '../components/MatchImportForm';
import {useActiveSeason} from '../hooks/useSeasons';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';

// Amsterdam time, whatever the device's zone
const timeStr = (iso: string) => formatTime(iso);

// Normalize field display: remove everything up to and including the first '-' and trim
function cleanField(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = String(name).trim();
  const parts = trimmed.split('-');
  if (parts.length > 1) {
    // take everything after the first '-'
    return parts.slice(1).join('-').trim();
  }
  return trimmed;
}

function MobileRow({ m }: { m: MatchSchedule }) {
  const [open, setOpen] = useState(false);
  const hasScore = m.homeScore != null || m.awayScore != null;
  const fieldShort = cleanField(m.fieldName);
  const shortenTeam = (name?: string | null) => (name || '').replace(/Fortuna\/Ruitenheer/gi, 'Fortuna').trim();
  const homeName = shortenTeam(m.homeTeamName);
  const awayName = shortenTeam(m.awayTeamName);
  return (
    <div className="py-1.5 px-2 border-b border-gray-200 dark:border-gray-800" role="listitem">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-mono text-sm text-gray-500 w-12 text-right shrink-0">{timeStr(m.date)}</div>
          <div className="flex items-center gap-1 min-w-0">
            {m.color && (
              <span
                aria-label="team-color"
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: m.color || undefined }}
              />
            )}
            <div className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[34vw]">{homeName}</div>
            <div className="text-gray-400 shrink-0">–</div>
            <div className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[34vw]">{awayName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
          {hasScore ? (
            <span className="font-mono" aria-label="score">
              {m.homeScore ?? ''} - {m.awayScore ?? ''}
            </span>
          ) : (
            fieldShort ? <span aria-label="field-short">{fieldShort}</span> : null
          )}
          <button
            aria-label="Details tonen"
            className="p-1 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded w-7 h-7 flex items-center justify-center"
            onClick={() => setOpen((v) => !v)}
            title={open ? 'Inklappen' : 'Uitklappen'}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex flex-col gap-1">
            {!hasScore && null}
            {hasScore && fieldShort && (
              <div>
                <span className="text-gray-500">Veld: </span>
                <span>{fieldShort}</span>
              </div>
            )}
            {m.refereeName && (
              <div>
                <span className="text-gray-500">Scheidsrechter: </span>
                <span>{m.refereeName}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchSchedulePage() {
  const today = todayAmsterdam();
  const [date, setDate] = useState<string>(today);
  const [location, setLocation] = useState<LocationFilter>('HOME');
  const { data, isLoading, isError, error, refetch } = useMatchSchedule(date, location);
  const { data: activeSeason } = useActiveSeason();

  const title = useMemo(() => {
    // The selected Amsterdam day (noon UTC lies on that same day in Amsterdam)
    return formatAmsterdamDate(`${date}T12:00:00Z`, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }, [date]);

  const columns = useMemo<ColumnDef<MatchSchedule>[]>(
    () => [
      {
        id: 'time',
        header: () => 'Tijd',
        accessorFn: (row) => timeStr(row.date),
        sortingFn: (a, b) => {
          // Compare underlying ISO date strings
          return a.original.date.localeCompare(b.original.date);
        },
        cell: (info) => <span className="font-mono">{info.getValue() as string}</span>,
      },
      {
        id: 'color',
        header: () => '',
        accessorFn: (row) => row.color || '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.color ? (
            <span
              aria-label="team-color"
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: row.original.color || undefined }}
            />
          ) : null,
      },
      {
        id: 'home',
        header: () => 'Thuis',
        accessorKey: 'homeTeamName',
      },
      {
        id: 'away',
        header: () => 'Uit',
        accessorKey: 'awayTeamName',
      },
      {
        id: 'score',
        header: () => 'Uitslag',
        accessorFn: (row) => `${row.homeScore ?? ''} - ${row.awayScore ?? ''}`,
        enableSorting: false,
        cell: (info) => <span className="font-mono">{String(info.getValue())}</span>,
      },
      {
        id: 'field',
        header: () => 'Veld',
        accessorFn: (row) => cleanField(row.fieldName) || '',
        cell: (info) => <span>{String(info.getValue() || '')}</span>,
      },
      {
        id: 'ref',
        header: () => 'Scheidsrechter',
        accessorKey: 'refereeName',
      },
    ],
    []
  );

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'time', desc: false }]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Wedstrijdprogramma</h1>
        <div className="flex items-center gap-2">
          <select
            aria-label="Thuis of uit"
            value={location}
            onChange={(e) => setLocation(e.target.value as LocationFilter)}
            className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1"
          >
            <option value="HOME">Thuis</option>
            <option value="AWAY">Uit</option>
            <option value="ALL">Alle</option>
          </select>
        </div>
      </div>

      <details className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 p-3" data-testid="match-schedule-import">
        <summary className="cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-100">Wedstrijden importeren</summary>
        <div className="mt-3">
          <MatchImportForm indoorStartDate={activeSeason?.indoorStartDate ?? null} onImported={() => void refetch()}/>
        </div>
      </details>

      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <button
            aria-label="Vorige week"
            onClick={() => setDate(prevWeekStr(date))}
            className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            « Week
          </button>
          <button
            aria-label="Vorige dag"
            onClick={() => setDate(prevDayStr(date))}
            className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ‹ Dag
          </button>
        </div>
        <div className="text-lg text-gray-700 dark:text-gray-300" aria-label="Gekozen dag">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Volgende dag"
            onClick={() => setDate(nextDayStr(date))}
            className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Dag ›
          </button>
          <button
            aria-label="Volgende week"
            onClick={() => setDate(nextWeekStr(date))}
            className="px-2 py-1 border rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Week »
          </button>
        </div>
      </div>

      {isLoading && <div role="status">Laden…</div>}
      {isError && <div role="alert">Fout: {(error as Error)?.message}</div>}

      {/* Mobile: cards with expandable details */}
      <div role="list" className="md:hidden divide-y divide-gray-200 dark:divide-gray-800 rounded-md bg-white/50 dark:bg-gray-900/50">
        {data?.map((m) => (
          <MobileRow key={m.externalId} m={m} />
        ))}
        {!isLoading && (!data || data.length === 0) && (
          <div className="text-gray-500 py-6 text-center">Geen wedstrijden</div>
        )}
      </div>

      {/* Desktop: TanStack Table */}
      <div className="hidden md:block overflow-x-auto rounded-md">
        <table className="min-w-full text-sm text-gray-900 dark:text-gray-100">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="px-3 py-2 text-left select-none cursor-pointer border-b border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: '▲', desc: '▼' }[h.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && (data || []).length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={columns.length}>Geen wedstrijden</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
