import {useQuery} from '@tanstack/react-query';
import {fetchStatsConnection, type StatsCheck} from '../lib/statsApi';

const REFRESH_MS = 15_000;

function Line({label, check}: {label: string; check: StatsCheck}) {
  if (!check) return null;
  return (
    <li className="flex items-center gap-2 min-w-0">
      <span aria-hidden className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${check.ok ? 'bg-green-500' : 'bg-red-500'}`}/>
      <span className="truncate">{label}: {check.ok ? `bereikbaar${check.ms != null ? ` (${check.ms} ms)` : ''}` : 'niet bereikbaar'}</span>
    </li>
  );
}

/** Can we reach the statistics PC: on the network (SMB), the database on the share and the page. */
export default function StatsConnectionStatus({auto = false}: {auto?: boolean}) {
  const {data, error, isFetching, refetch} = useQuery({
    queryKey: ['stats', 'connection'],
    queryFn: fetchStatsConnection,
    refetchInterval: auto ? REFRESH_MS : false,
    enabled: auto,
  });
  return (
    <div className="text-sm" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <span className="font-medium">Verbinding met de statistiek-pc</span>
        <button type="button" onClick={() => refetch()} disabled={isFetching}
          className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
          {isFetching ? 'Testen…' : 'Verbinding testen'}
        </button>
      </div>
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {data && (
        <ul className="space-y-1">
          {!data.network && <li className="text-gray-500">Geen adres van de statistiek-pc ingesteld.</li>}
          <Line label={`Netwerk (${data.host ?? '?'})`} check={data.network}/>
          <Line label="Database op de share" check={data.file}/>
          <Line label="Statistiekenpagina" check={data.page}/>
        </ul>
      )}
    </div>
  );
}
