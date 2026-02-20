import React from 'react';
import {useCrewRolesReport, useDailyOccupancyReport, useInterviewsReport} from '../hooks/useReports';
import {useNextProductionDate, useProductionDates} from '../hooks/useProductions';
import SimpleCalendar from '../components/SimpleCalendar';
import '../styles/calendar.css';
import {createColumnHelper, flexRender, getCoreRowModel, useReactTable,} from '@tanstack/react-table';
import {downloadAsPng} from '../lib/download';
import {MdDownload} from 'react-icons/md';
import PlayerCard from '../components/PlayerCard';

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// --- Generic Table Component ---
function DataTable({ data, columns, stickyFirstColumn = false, id, caption }: { data: any[]; columns: any[]; stickyFirstColumn?: boolean; id?: string; caption?: string }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div id={id} className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
      {caption && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 font-bold text-lg text-center">
          {caption}
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <th
                  key={header.id}
                  className={`px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap ${
                    stickyFirstColumn && index === 0 ? 'sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700' : ''
                  }`}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900' : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'}
            >
              {row.getVisibleCells().map((cell, index) => (
                <td
                  key={cell.id}
                  className={`px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300 ${
                    stickyFirstColumn && index === 0
                      ? `sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 font-medium ${
                          rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50 dark:bg-gray-900'
                        }`
                      : ''
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                Geen gegevens gevonden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


function DailyOccupancyReport() {
  const {data: nextDate} = useNextProductionDate();
  const {data: productionDates} = useProductionDates();
  const [date, setDate] = React.useState('');
  const [showCalendar, setShowCalendar] = React.useState(false);

  React.useEffect(() => {
    if (nextDate && !date) {
      setDate(nextDate);
    } else if (!date) {
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [nextDate, date]);

  const {data, isLoading, error} = useDailyOccupancyReport(date);
  const {data: interviewsData} = useInterviewsReport(); // Fetch all interviews, filter by date locally or ideally API should support date filter

  const handleDateChange = (value: Date) => {
    const offset = value.getTimezoneOffset();
    const adjustedDate = new Date(value.getTime() - (offset * 60 * 1000));
    setDate(adjustedDate.toISOString().split('T')[0]);
    setShowCalendar(false);
  };

  const columns = React.useMemo(() => {
    if (!data) return [];
    const helper = createColumnHelper<any>();

    const cols = [
      helper.accessor('name', {
        header: 'Persoon',
        cell: info => info.getValue(),
      }),
    ];

    data.productions.forEach(prod => {
      cols.push(
        helper.accessor(row => row.assignments[prod.id], {
          id: `prod-${prod.id}`,
          header: () => (
            <div className="text-center">
              <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{prod.homeTeam}</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {formatTime(prod.time)}
                {prod.liveTime && ` (${formatTime(prod.liveTime)})`}
              </div>
            </div>
          ),
          cell: info => {
            const roles = info.getValue();
            return roles && roles.length > 0 ? (
              <div className="text-center">{roles.join(', ')}</div>
            ) : (
              <div className="text-center text-gray-400">-</div>
            );
          },
        })
      );
    });

    return cols;
  }, [data]);

  // Filter interviews for the selected date
  const dailyInterviews = React.useMemo(() => {
    if (!interviewsData || !date) return [];
    // Assuming interviewsData returns a list of productions with interviews
    // We need to filter productions that match the selected date
    return interviewsData.filter((p: any) => {
      const pDate = new Date(p.date).toISOString().split('T')[0];
      return pDate === date;
    });
  }, [interviewsData, date]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 relative">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Datum:</label>
          <div className="relative">
            <input
              type="text"
              value={date ? formatDate(date) : ''}
              readOnly
              onClick={() => setShowCalendar(!showCalendar)}
              className="border rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700 cursor-pointer w-48 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            {showCalendar && (
              <div className="absolute top-full left-0 mt-2 z-50 shadow-xl rounded-lg overflow-hidden">
                <SimpleCalendar
                  onChange={handleDateChange}
                  value={date ? new Date(date) : new Date()}
                  markedDates={productionDates}
                />
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => downloadAsPng('daily-occupancy-container', `dagbezetting-${date}`)}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
          disabled={!data}
        >
          <MdDownload className="text-lg" />
          <span>Download PNG</span>
        </button>
      </div>

      {isLoading && <div className="text-gray-500 animate-pulse">Laden...</div>}
      {error && <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">Fout bij laden: {(error as any).message}</div>}

      {data && (
        <div id="daily-occupancy-container" className="space-y-8 bg-white dark:bg-gray-950 p-4 rounded-lg">
          <DataTable
            data={data.persons}
            columns={columns}
            stickyFirstColumn={true}
            caption={`Dagbezetting - ${formatDate(date)}`}
          />

          {/* Interviews Section per Production */}
          {dailyInterviews.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Interviews</h2>
              <div className="space-y-8">
                {dailyInterviews.map((prod: any) => (
                  <div key={prod.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                        {prod.homeTeam} vs {prod.awayTeam}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatTime(prod.date)}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Away Team (First) */}
                      <div>
                        <h4 className="font-medium text-red-700 dark:text-red-400 mb-3 uppercase text-sm tracking-wide">Uit: {prod.awayTeam}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {prod.awayInterviews.length > 0 ? (
                            prod.awayInterviews.map((i: any, idx: number) => (
                              <PlayerCard
                                key={`away-${idx}`}
                                name={i.name}
                                // Assuming API returns image URL or we construct it.
                                // The useInterviewsReport hook might need to ensure image is included.
                                // If not, we fallback to placeholder.
                                photoUrl={i.photoUrl}
                                function={i.role === 'COACH' ? 'Coach' : 'Speler'}
                                shirtNo={i.shirtNo}
                              />
                            ))
                          ) : (
                            <span className="text-sm text-gray-400 italic">Geen interviews</span>
                          )}
                        </div>
                      </div>

                      {/* Home Team */}
                      <div>
                        <h4 className="font-medium text-green-700 dark:text-green-400 mb-3 uppercase text-sm tracking-wide">Thuis: {prod.homeTeam}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {prod.homeInterviews.length > 0 ? (
                            prod.homeInterviews.map((i: any, idx: number) => (
                              <PlayerCard
                                key={`home-${idx}`}
                                name={i.name}
                                photoUrl={i.photoUrl}
                                function={i.role === 'COACH' ? 'Coach' : 'Speler'}
                              />
                            ))
                          ) : (
                            <span className="text-sm text-gray-400 italic">Geen interviews</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewsReport() {
  const {data, isLoading, error} = useInterviewsReport();

  const columns = React.useMemo(() => {
    const helper = createColumnHelper<any>();
    return [
      helper.accessor('date', {
        header: 'Datum',
        cell: info => formatDate(info.getValue()),
      }),
      helper.accessor('date', {
        id: 'time',
        header: 'Tijd',
        cell: info => {
          const time = formatTime(info.getValue());
          const liveTime = info.row.original.liveTime ? ` (${formatTime(info.row.original.liveTime)})` : '';
          return `${time}${liveTime}`;
        },
      }),
      helper.accessor(row => `${row.homeTeam} vs ${row.awayTeam}`, {
        id: 'match',
        header: 'Wedstrijd',
        cell: info => <span className="font-medium">{info.getValue()}</span>,
      }),
      helper.accessor('homeInterviews', {
        header: 'Thuis Interviews',
        cell: info => (
          <div className="space-y-1">
            {info.getValue().map((i: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-medium">{i.name}</span>
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{i.role}</span>
              </div>
            ))}
          </div>
        ),
      }),
      helper.accessor('awayInterviews', {
        header: 'Uit Interviews',
        cell: info => (
          <div className="space-y-1">
            {info.getValue().map((i: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-medium">{i.name}</span>
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{i.role}</span>
              </div>
            ))}
          </div>
        ),
      }),
    ];
  }, []);

  if (isLoading) return <div className="text-gray-500 animate-pulse">Laden...</div>;
  if (error) return <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">Fout bij laden: {(error as any).message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => downloadAsPng('interviews-report', 'interviews-report')}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
          disabled={!data}
        >
          <MdDownload className="text-lg" />
          <span>Download PNG</span>
        </button>
      </div>
      <DataTable id="interviews-report" data={data || []} columns={columns} />
    </div>
  );
}

function CrewRolesReport() {
  const {data, isLoading, error} = useCrewRolesReport();

  const columns = React.useMemo(() => {
    const helper = createColumnHelper<any>();
    return [
      helper.accessor('date', {
        header: 'Datum',
        cell: info => formatDate(info.getValue()),
      }),
      helper.accessor('date', {
        id: 'time',
        header: 'Tijd',
        cell: info => {
          const time = formatTime(info.getValue());
          const liveTime = info.row.original.liveTime ? ` (${formatTime(info.row.original.liveTime)})` : '';
          return `${time}${liveTime}`;
        },
      }),
      helper.accessor(row => `${row.homeTeam} vs ${row.awayTeam}`, {
        id: 'match',
        header: 'Wedstrijd',
        cell: info => <span className="font-medium">{info.getValue()}</span>,
      }),
      helper.accessor('speaker', {
        header: 'Speaker',
        cell: info => info.getValue().join(', ') || <span className="text-gray-400">-</span>,
      }),
      helper.accessor('regisseur', {
        header: 'Regisseur',
        cell: info => info.getValue().join(', ') || <span className="text-gray-400">-</span>,
      }),
      helper.accessor('presentator', {
        header: 'Presentator',
        cell: info => info.getValue().join(', ') || <span className="text-gray-400">-</span>,
      }),
      helper.accessor('analist', {
        header: 'Analist',
        cell: info => info.getValue().join(', ') || <span className="text-gray-400">-</span>,
      }),
    ];
  }, []);

  if (isLoading) return <div className="text-gray-500 animate-pulse">Laden...</div>;
  if (error) return <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">Fout bij laden: {(error as any).message}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => downloadAsPng('crew-roles-report', 'crew-roles-report')}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
          disabled={!data}
        >
          <MdDownload className="text-lg" />
          <span>Download PNG</span>
        </button>
      </div>
      <DataTable id="crew-roles-report" data={data || []} columns={columns} />
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = React.useState<'occupancy' | 'interviews' | 'crew'>('occupancy');

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Rapportages</h1>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'occupancy' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('occupancy')}
        >
          Dagbezetting
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'interviews' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('interviews')}
        >
          Interviews
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'crew' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('crew')}
        >
          Crew Rollen
        </button>
      </div>

      <div className="print:block">
        {activeTab === 'occupancy' && <DailyOccupancyReport />}
        {activeTab === 'interviews' && <InterviewsReport />}
        {activeTab === 'crew' && <CrewRolesReport />}
      </div>
    </div>
  );
}
