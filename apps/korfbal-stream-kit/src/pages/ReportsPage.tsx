import React from 'react';
import {
  useCrewRolesReport,
  useDailyOccupancyByPositionReport,
  useDailyOccupancyReport,
  useInterviewsReport
} from '../hooks/useReports';
import {useProductions} from '../hooks/useProductions';
import {createColumnHelper, flexRender, getCoreRowModel, useReactTable,} from '@tanstack/react-table';
import {downloadAsPng} from '../lib/download';
import {MdClose, MdDownload} from 'react-icons/md';
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
function DataTable({ data, columns, stickyFirstColumn = false, id, caption }: Readonly<{
  data: any[];
  columns: any[];
  stickyFirstColumn?: boolean;
  id?: string;
  caption?: string
}>) {
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
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-lg data-table">
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
  const {data: productionsData} = useProductions();
  const [date, setDate] = React.useState('');

  const sortedProductions = React.useMemo(() => {
    if (!productionsData?.items) return [];
    return [...productionsData.items].sort((a, b) => {
      const dateA = new Date(a.matchSchedule?.date || 0).getTime();
      const dateB = new Date(b.matchSchedule?.date || 0).getTime();
      return dateB - dateA;
    });
  }, [productionsData]);

  React.useEffect(() => {
    if (sortedProductions.length > 0 && !date) {
      const now = new Date().getTime();
      const nextProd = [...sortedProductions]
        .reverse()
        .find(p => new Date(p.matchSchedule?.date || 0).getTime() >= now - (24 * 60 * 60 * 1000));

      const defaultDate = nextProd?.matchSchedule?.date || sortedProductions[0].matchSchedule?.date;
      if (defaultDate) {
        setDate(new Date(defaultDate).toISOString().split('T')[0]);
      }
    } else if (!date && !productionsData) {
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [sortedProductions, date, productionsData]);

  const {data, isLoading, error} = useDailyOccupancyReport(date);
  const {data: interviewsData} = useInterviewsReport();

  const handleProductionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDate(e.target.value);
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
        helper.accessor((row: any): string[] => row.assignments[prod.id], {
          id: `prod-${prod.id}`,
          header: () => (
            <div className="text-center">
              <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{prod.homeTeam}</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {formatTime(prod.time)}
                {prod.liveTime && (
                  <>
                    <br />
                    LIVE: {formatTime(prod.liveTime)}
                    {prod.endLiveTime && ` - ${formatTime(prod.endLiveTime)}`}
                  </>
                )}
              </div>
            </div>
          ),
          cell: info => {
            const roles = info.getValue();
            const person = info.row.original;
            const prodId = prod.id;
            const isPresent = person.presence && person.presence[prodId];

            if (roles && roles.length > 0) {
              return <div className="text-center">{roles.join(', ')}</div>;
            }

            if (isPresent) {
              return <div className="text-center text-gray-400 font-italic text-xs">Geen positie</div>;
            }

            return (
              <div className="flex justify-center">
                <MdClose className="text-red-500 text-lg" />
              </div>
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
    // Filter productions that match the selected date AND (have interviews OR have remarks OR have matchSponsor)
    return interviewsData.filter((p: any) => {
      const pDate = new Date(p.date).toISOString().split('T')[0];
      const hasInterviews = p.homeInterviews.length > 0 || p.awayInterviews.length > 0;
      const hasRemarks = !!p.remarks;
      const hasSponsor = !!p.matchSponsor;
      return pDate === date && (hasInterviews || hasRemarks || hasSponsor);
    });
  }, [interviewsData, date]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between no-export">
        <div className="flex items-center gap-2 relative">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Productie:</label>
          <select
            value={date}
            onChange={handleProductionChange}
            className="border rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm min-w-[300px]"
          >
            {sortedProductions.length === 0 && <option value="">Geen producties gevonden</option>}
            {sortedProductions.map(p => {
              const pDate = p.matchSchedule?.date ? new Date(p.matchSchedule.date).toISOString().split('T')[0] : '';
              return (
                <option key={p.id} value={pDate}>
                  {p.matchSchedule ? `${formatDate(p.matchSchedule.date)} - ${p.matchSchedule.homeTeamName} vs ${p.matchSchedule.awayTeamName}` : `Productie ${p.id}`}
                </option>
              );
            })}
          </select>
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
        <div id="daily-occupancy-container" className="space-y-8 bg-white dark:bg-gray-950 p-6 rounded-lg report-container">
          <DataTable
            data={data.persons}
            columns={columns}
            stickyFirstColumn={true}
            caption={`Dagbezetting - ${formatDate(date)}`}
          />

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4 px-2">
            <MdClose className="text-red-500 text-lg flex-shrink-0" />
            <span className="font-medium">Een rood kruisje betekent dat de persoon niet aanwezig is (afwezig gemeld).</span>
          </div>

          {/* Interviews Section per Production */}
          {dailyInterviews.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 text-center bg-gray-50 dark:bg-gray-800 py-2">Productie Details & Interviews</h2>
              <div className="space-y-8">
                {dailyInterviews.map((prod: any) => (
                  <div key={prod.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                        {prod.homeTeam} vs {prod.awayTeam}
                      </h3>
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">WEDSTRIJD: {formatTime(prod.date)}</span>
                        {prod.liveTime && (
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-bold">
                            LIVE: {formatTime(prod.liveTime)}
                            {prod.endLiveTime && ` - ${formatTime(prod.endLiveTime)}`}
                          </span>
                        )}
                        {prod.matchSponsor && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 italic">Sponsor: {prod.matchSponsor}</span>
                        )}
                      </div>
                    </div>

                    {(prod.homeInterviews.length > 0 || prod.awayInterviews.length > 0) && (
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
                    )}

                    {prod.remarks && (
                      <div className={`${(prod.homeInterviews.length > 0 || prod.awayInterviews.length > 0) ? 'mt-6 pt-6 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                        <h4 className="font-bold text-sm mb-2 uppercase tracking-wide text-gray-500">Opmerkingen uit productierapport:</h4>
                        <div className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                          {prod.remarks}
                        </div>
                      </div>
                    )}
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
          const row = info.row.original;
          let liveStr = '';
          if (row.liveTime) {
            liveStr = ` (LIVE: ${formatTime(row.liveTime)}`;
            if (row.endLiveTime) {
              liveStr += ` - ${formatTime(row.endLiveTime)}`;
            }
            liveStr += `)`;
          }
          return `${time}${liveStr}`;
        },
      }),
      helper.accessor((row: any) => `${row.homeTeam} vs ${row.awayTeam}`, {
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
      helper.accessor('remarks', {
        header: 'Opmerkingen',
        cell: info => <span className="text-sm italic">{info.getValue() || '-'}</span>,
      }),
      helper.accessor('matchSponsor', {
        header: 'Sponsor',
        cell: info => <span className="text-sm font-medium">{info.getValue() || '-'}</span>,
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


function OccupancyByPositionReport() {
  const {data: productionsData} = useProductions();
  const [date, setDate] = React.useState('');

  const sortedProductions = React.useMemo(() => {
    if (!productionsData?.items) return [];
    return [...productionsData.items].sort((a, b) => {
      const dateA = new Date(a.matchSchedule?.date || 0).getTime();
      const dateB = new Date(b.matchSchedule?.date || 0).getTime();
      return dateB - dateA;
    });
  }, [productionsData]);

  React.useEffect(() => {
    if (sortedProductions.length > 0 && !date) {
      const now = new Date().getTime();
      const nextProd = [...sortedProductions]
        .reverse()
        .find(p => new Date(p.matchSchedule?.date || 0).getTime() >= now - (24 * 60 * 60 * 1000));

      const defaultDate = nextProd?.matchSchedule?.date || sortedProductions[0].matchSchedule?.date;
      if (defaultDate) {
        setDate(new Date(defaultDate).toISOString().split('T')[0]);
      }
    } else if (!date && !productionsData) {
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [sortedProductions, date, productionsData]);

  const handleProductionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDate(e.target.value);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between no-export">
        <div className="flex items-center gap-2 relative">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Productie:</label>
          <select
            value={date}
            onChange={handleProductionChange}
            className="border rounded-md px-3 py-2 bg-white dark:bg-gray-900 dark:border-gray-700 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm min-w-[300px]"
          >
            {sortedProductions.length === 0 && <option value="">Geen producties gevonden</option>}
            {sortedProductions.map(p => {
              const pDate = p.matchSchedule?.date ? new Date(p.matchSchedule.date).toISOString().split('T')[0] : '';
              return (
                <option key={p.id} value={pDate}>
                  {p.matchSchedule ? `${formatDate(p.matchSchedule.date)} - ${p.matchSchedule.homeTeamName} vs ${p.matchSchedule.awayTeamName}` : `Productie ${p.id}`}
                </option>
              );
            })}
          </select>
        </div>
        <button
          onClick={() => downloadAsPng('daily-occupancy-by-position-container', `positiebezetting-${date}`)}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
        >
          <MdDownload className="text-lg" />
          <span>Download PNG</span>
        </button>
      </div>

      <div id="daily-occupancy-by-position-container" className="bg-white dark:bg-gray-950 p-6 rounded-lg report-container">
        <OccupancyByPositionTable date={date} />
      </div>
    </div>
  );
}

function OccupancyByPositionTable({ date }: { date: string }) {
  const { data, isLoading, error } = useDailyOccupancyByPositionReport(date);

  const columns = React.useMemo(() => {
    if (!data) return [];
    const helper = createColumnHelper<any>();

    const cols = [
      helper.accessor('name', {
        header: 'Positie',
        cell: info => {
          const row = (info.row.original as any);
          return (
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{row.name}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-tighter">{row.category}</div>
            </div>
          );
        },
      }),
    ];

    data.productions.forEach(prod => {
      cols.push(
        helper.accessor((row: any): string[] => row.assignments[prod.id], {
          id: `prod-${prod.id}`,
          header: () => (
            <div className="text-center">
              <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{prod.homeTeam}</div>
              <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {formatTime(prod.time)}
                {prod.liveTime && (
                  <>
                    <br />
                    LIVE: {formatTime(prod.liveTime)}
                    {prod.endLiveTime && ` - ${formatTime(prod.endLiveTime)}`}
                  </>
                )}
              </div>
            </div>
          ),
          cell: info => {
            const persons = info.getValue();
            return persons && persons.length > 0 ? (
              <div className="text-center font-medium text-gray-800 dark:text-gray-200">{persons.join(', ')}</div>
            ) : (
              <div className="flex justify-center">
                <MdClose className="text-red-500 text-lg opacity-20" />
              </div>
            );
          },
        })
      );
    });

    return cols;
  }, [data]);

  if (isLoading) return <div className="text-gray-400 animate-pulse text-sm py-4">Positiebezetting laden...</div>;
  if (error) return null;
  if (!data || data.positions.length === 0) return null;

  return (
    <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-8 space-y-4">
      <DataTable
        data={data.positions}
        columns={columns}
        stickyFirstColumn={true}
        caption={`Bezetting per Positie - ${formatDate(date)}`}
      />
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4 px-2">
        <MdClose className="text-red-500 text-lg flex-shrink-0" />
        <span className="font-medium">Een rood kruisje betekent dat de positie niet is ingevuld (onbezet).</span>
      </div>
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
          const row = info.row.original;
          let liveStr = '';
          if (row.liveTime) {
            liveStr = ` (LIVE: ${formatTime(row.liveTime)}`;
            if (row.endLiveTime) {
              liveStr += ` - ${formatTime(row.endLiveTime)}`;
            }
            liveStr += `)`;
          }
          return `${time}${liveStr}`;
        },
      }),
      helper.accessor((row: any) => `${row.homeTeam} vs ${row.awayTeam}`, {
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
  const [activeTab, setActiveTab] = React.useState<'occupancy' | 'positions' | 'interviews' | 'crew'>('occupancy');

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
          className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'positions' ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          onClick={() => setActiveTab('positions')}
        >
          Positieoverzicht
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
        {activeTab === 'positions' && <OccupancyByPositionReport />}
        {activeTab === 'interviews' && <InterviewsReport />}
        {activeTab === 'crew' && <CrewRolesReport />}
      </div>
    </div>
  );
}
