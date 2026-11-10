import {useStatsConnection} from '../hooks/useStatsConnection';
import type {StatsCheck} from '../lib/statsApi';

function Dot({ok}: {ok: boolean}) {
  return <span aria-hidden className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`}/>;
}

function Line({label, check}: {label: string; check: StatsCheck | undefined}) {
  if (!check) return null;
  return (
    <li className="flex items-center gap-2 min-w-0">
      <Dot ok={check.ok}/>
      <span className="truncate">{label}: {check.ok ? `bereikbaar${check.ms != null ? ` (${check.ms} ms)` : ''}` : 'niet bereikbaar'}</span>
    </li>
  );
}

/** Is the venue-bridge online, and through it: the statistics PC on the network, the database and the page. */
export default function StatsConnectionStatus({auto = false}: {auto?: boolean}) {
  const {data, error, isFetching, refetch} = useStatsConnection(auto);
  const online = data?.bridge.ok === true;
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
          <li className="flex items-center gap-2 min-w-0">
            <Dot ok={online}/>
            <span className="truncate">Venue-bridge: {online ? `online${data.bridge.ms != null ? ` (${data.bridge.ms} ms)` : ''}` : 'offline'}</span>
          </li>
          {online && !data.network && data.database !== 'disabled' && <li className="text-gray-500">Geen adres van de statistiek-pc ingesteld op de bridge.</li>}
          {online && <Line label={`Netwerk (${data.host ?? '?'})`} check={data.network}/>}
          {online && data.database === 'disabled' && <li className="text-gray-500">Database: uitgeschakeld op de bridge (alleen de statistiekenpagina)</li>}
          {online && data.database !== 'disabled' && <Line label="Database op de share" check={data.database}/>}
          {online && <Line label="Statistiekenpagina" check={data.page}/>}
        </ul>
      )}
    </div>
  );
}
