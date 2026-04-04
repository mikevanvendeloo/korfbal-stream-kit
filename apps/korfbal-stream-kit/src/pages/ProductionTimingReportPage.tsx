import {Link, useParams} from 'react-router-dom';
import {useCrewReport} from '../hooks/useCallsheet';
import {useProduction} from '../hooks/useProductions';
import {MdArrowBack, MdDownload} from 'react-icons/md';

export default function ProductionTimingReportPage() {
  const params = useParams<{ id: string }>();
  const productionId = Number(params.id);
  const { data, isLoading, error } = useCrewReport(productionId);
  const production = useProduction(productionId);

  if (!productionId) return <div className="container py-6">Ongeldig productie ID</div>;
  if (isLoading || production.isLoading) return <div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!data) return <div className="container py-6 text-gray-800 dark:text-gray-100">Geen data gevonden</div>;

  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return '-';
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds == null || seconds < 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const matchTitle = production.data?.matchSchedule
    ? `${production.data.matchSchedule.homeTeamName} vs ${production.data.matchSchedule.awayTeamName}`
    : `Productie ${productionId}`;

  const allItems = data.callsheets.flatMap(cs => cs.items).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  // Pre-calculate actual durations based on start time of next item
  const itemActualDurations: Record<string, number> = {};
  const sortedEvents = [...(data.productionEvents || [])]
    .filter(e => e.actualStartTime)
    .sort((a, b) => new Date(a.actualStartTime!).getTime() - new Date(b.actualStartTime!).getTime());

  for (let i = 0; i < sortedEvents.length; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    if (current.callSheetItemId) {
      if (next && next.actualStartTime) {
        const duration = Math.round((new Date(next.actualStartTime).getTime() - new Date(current.actualStartTime!).getTime()) / 1000);
        itemActualDurations[current.callSheetItemId] = duration;
      } else if (current.durationSec) {
        // Fallback to its own recorded duration if it's the last item
        itemActualDurations[current.callSheetItemId] = current.durationSec;
      }
    }
  }

  return (
    <div className="container py-6 max-w-6xl mx-auto px-4 text-gray-800 dark:text-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link to={`/admin/productions/${productionId}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mb-2">
            <MdArrowBack /> Terug naar productie
          </Link>
          <h1 className="text-2xl font-bold">{matchTitle}</h1>
          <p className="text-gray-500 dark:text-gray-400">Tijdsverloop en analyse rapportage</p>
        </div>
        <button
          onClick={() => {
            // We create a CSV for simplicity as it's easily opened in Excel
            const rows: string[][] = [
              ['Segment', 'Item Titel', 'Geplande Start', 'Werkelijke Start', 'Geplande Duur', 'Werkelijke Duur', 'Status']
            ];

            data.callsheets.forEach(cs => {
              cs.items.forEach(item => {
                const event = data.productionEvents?.find(e => e.callSheetItemId === item.id);
                const actualDuration = itemActualDurations[item.id] ?? event?.durationSec;
                rows.push([
                  item.productionSegment?.naam || '-',
                  item.title,
                  formatTime(item.timeStart),
                  formatTime(event?.actualStartTime),
                  formatDuration(item.durationSec),
                  formatDuration(actualDuration),
                  event?.status || 'Niet gestart'
                ]);
              });
            });

            const csvContent = rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `tijdsanalyse-productie-${productionId}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
        >
          <MdDownload /> Export naar Excel (CSV)
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Segment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gepland</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Werkelijk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Afw. Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duur (G)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duur (W)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {allItems.map((item) => {
                const event = data.productionEvents?.find(e => e.callSheetItemId === item.id);
                const actualDuration = itemActualDurations[item.id] ?? event?.durationSec;

                // Calculate time difference in minutes
                let diffText = '-';
                if (item.timeStart && event?.actualStartTime) {
                  const planned = new Date(item.timeStart).getTime();
                  const actual = new Date(event.actualStartTime).getTime();
                  const diffMin = Math.round((actual - planned) / 60000);
                  if (diffMin > 0) diffText = `+${diffMin}m`;
                  else if (diffMin < 0) diffText = `${diffMin}m`;
                  else diffText = '0m';
                }

                const isLate = diffText.startsWith('+') && parseInt(diffText.substring(1)) > 1;

                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[120px]">{item.productionSegment?.naam || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.title}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{formatTime(item.timeStart)}</td>
                    <td className="px-4 py-3 text-sm font-mono">{formatTime(event?.actualStartTime)}</td>
                    <td className={`px-4 py-3 text-sm font-mono ${isLate ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                      {diffText}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDuration(item.durationSec)}</td>
                    <td className="px-4 py-3 text-sm">{formatDuration(actualDuration)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        event?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        event?.status === 'FINISHED' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {event?.status || 'GEPLAND'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 text-xs text-gray-400 text-center">
        Dit rapport is gegenereerd op {new Date().toLocaleString('nl-NL')}
      </div>
    </div>
  );
}
