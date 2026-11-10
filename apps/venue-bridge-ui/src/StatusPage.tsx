import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Button, Card, CardContent, CardHeader, CardTitle, KeyValueRow, StatusBadge, type StatusTone} from '@korfbal-stream-kit/ui';
import {fetchBridgeStatus, REFRESH_MS, type BridgeStatus, type DatabaseStatus, type DeviceState} from './status';

const DEVICE_LABEL: Record<keyof BridgeStatus['devices'], string> = {score: 'Scorebord', clock: 'Zaalklok', shotclock: 'Shotclock'};

const DEVICE_STATE: Record<DeviceState, {tone: StatusTone; text: string}> = {
  ok: {tone: 'ok', text: 'Verbonden'},
  unreachable: {tone: 'error', text: 'Niet bereikbaar'},
  invalid: {tone: 'error', text: 'Ongeldig antwoord'},
  'not-configured': {tone: 'neutral', text: 'Niet ingesteld'},
  unknown: {tone: 'warn', text: 'Nog geen meting'},
};

/** "3 s geleden", "2 min geleden" */
export function formatAge(ageMs: number | null): string {
  if (ageMs === null) return 'geen meting';
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s} s geleden`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min geleden`;
  return `${Math.floor(m / 60)} u geleden`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('nl-NL', {timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'});
}

const ageOf = (iso: string | null, now: number) => (iso ? formatAge(Math.max(0, now - Date.parse(iso))) : 'nog niet');

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`;
}

/** The database rows: where the last answer came from, the share, the local copy and the last failure. */
function DatabaseRows({share, keepCopy, now}: {share: DatabaseStatus; keepCopy: boolean | null; now: number}) {
  const answer = share.lastAnswer;
  // The last failure only counts while nothing succeeded after it
  const failing = share.lastError && (!share.shareCheckedAt || Date.parse(share.lastError.at) >= Date.parse(share.shareCheckedAt));
  return <>
    <KeyValueRow label="Laatste antwoord">
      {!answer
        ? <StatusBadge tone="neutral">Nog niet gevraagd</StatusBadge>
        : <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {answer.source === 'share'
            ? <StatusBadge tone="ok">Van de share</StatusBadge>
            : <StatusBadge tone="warn">Van de lokale kopie</StatusBadge>}
          <span className="text-gray-500 dark:text-gray-400">cijfers van {formatTime(answer.readAt)}{answer.team ? `, team ${answer.team}` : ''}</span>
        </span>}
    </KeyValueRow>
    <KeyValueRow label="Share">
      {share.skipUntil
        ? <StatusBadge tone="error">Overgeslagen tot {formatTime(share.skipUntil)} ({share.failures}× mislukt)</StatusBadge>
        : failing
          ? <StatusBadge tone="error">Mislukt</StatusBadge>
          : share.shareCheckedAt
            ? <StatusBadge tone="ok">Bereikbaar</StatusBadge>
            : <StatusBadge tone="neutral">Nog niet gebruikt</StatusBadge>}
    </KeyValueRow>
    {share.hostReachable !== null && (
      <KeyValueRow label="Statistiek-pc op het netwerk">{share.hostReachable ? 'Ja' : 'Nee'}</KeyValueRow>
    )}
    <KeyValueRow label="Laatst gekeken">{ageOf(share.shareCheckedAt, now)}</KeyValueRow>
    <KeyValueRow label="Laatst gelezen">{ageOf(share.shareReadAt, now)}{share.parseMs !== null ? `, ingelezen in ${share.parseMs} ms` : ''}</KeyValueRow>
    <KeyValueRow label="Bestand gewijzigd">{share.fileModifiedAt ? `${formatTime(share.fileModifiedAt)} (${formatBytes(share.fileBytes)})` : '-'}</KeyValueRow>
    <KeyValueRow label="Lokale kopie">
      {keepCopy === false ? 'Uit' : share.copyError
        ? <StatusBadge tone="error">{share.copyError.message}</StatusBadge>
        : share.copyWrittenAt ? `Geschreven ${ageOf(share.copyWrittenAt, now)}` : 'Nog niet geschreven'}
    </KeyValueRow>
    {share.lastError && (
      <KeyValueRow label="Laatste fout">{share.lastError.message} ({ageOf(share.lastError.at, now)})</KeyValueRow>
    )}
  </>;
}

function CopyButton({text}: {text: string}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available (plain http): the address stays selectable */
    }
  }
  return <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={`Kopieer ${text}`}>{copied ? 'Gekopieerd' : 'Kopieer'}</Button>;
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <Card>
      <CardHeader className="p-4"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

/** The bridge's status for whoever stands at the venue: no secrets, polled every 2 s. */
export default function StatusPage() {
  const {data, isError, isPending} = useQuery({queryKey: ['bridge-status'], queryFn: fetchBridgeStatus, refetchInterval: REFRESH_MS});
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  if (isPending) return <main className="mx-auto max-w-3xl p-4"><p>Laden…</p></main>;
  if (isError || !data) {
    return (
      <main className="mx-auto max-w-3xl p-4 space-y-4">
        <h1 className="text-xl font-semibold">Venue-bridge</h1>
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">De bridge zelf is niet bereikbaar. Controleer of de container draait.</p>
      </main>
    );
  }

  const {api, config} = data;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Venue-bridge {data.name}</h1>
        <span className="text-xs text-gray-500 dark:text-gray-400">versie {data.version}</span>
      </header>

      <Section title="Verbinding met de API">
        <dl>
          <KeyValueRow label="Status">
            {api.connected
              ? <StatusBadge tone="ok">Verbonden met de API</StatusBadge>
              : <StatusBadge tone="error">Niet verbonden met de API</StatusBadge>}
          </KeyValueRow>
          {api.connected && api.since && <KeyValueRow label="Verbonden sinds">{formatTime(api.since)}</KeyValueRow>}
          {!api.connected && api.error && <KeyValueRow label="Laatste fout">{api.error}</KeyValueRow>}
          <KeyValueRow label="Configuratie">
            {config.state === 'applied'
              ? <StatusBadge tone="ok">Ontvangen</StatusBadge>
              : <StatusBadge tone="warn">Nog geen configuratie</StatusBadge>}
          </KeyValueRow>
          {config.state === 'applied' && <>
            <KeyValueRow label="Laatst ontvangen">{formatTime(config.receivedAt)}</KeyValueRow>
            {config.version && <KeyValueRow label="Configuratieversie">{config.version}</KeyValueRow>}
            {config.source === 'cache' && <KeyValueRow label="Bron">Opgeslagen kopie (de API stuurde nog niets)</KeyValueRow>}
          </>}
        </dl>
        {!api.connected && config.state === 'applied' && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">De bridge werkt door met de laatst ontvangen configuratie.</p>
        )}
      </Section>

      <Section title="Apparaten">
        <dl>
          {(Object.keys(DEVICE_LABEL) as (keyof BridgeStatus['devices'])[]).map((device) => {
            const {state, ageMs} = data.devices[device];
            const view = DEVICE_STATE[state];
            const host = device === 'score' ? data.hosts.scoreboard : device === 'shotclock' ? data.hosts.shotclock : null;
            return (
              <KeyValueRow key={device} label={DEVICE_LABEL[device]}>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge tone={view.tone}>{view.text}</StatusBadge>
                  {state !== 'not-configured' && <span className="text-gray-500 dark:text-gray-400">{formatAge(ageMs)}</span>}
                  {host && <span className="text-gray-500 dark:text-gray-400">{host}</span>}
                </span>
              </KeyValueRow>
            );
          })}
        </dl>
      </Section>

      <Section title="vMix">
        {data.vmix.length === 0
          ? <p className="text-sm text-gray-600 dark:text-gray-300">Geen vMix-pc's ingesteld.</p>
          : <dl>
            {data.vmix.map((instance) => (
              <KeyValueRow key={instance.id} label={instance.name}>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge tone={instance.state === 'ok' ? 'ok' : instance.state === 'unreachable' ? 'error' : 'warn'}>
                    {instance.state === 'ok' ? 'Bereikbaar' : instance.state === 'unreachable' ? 'Niet bereikbaar' : 'Nog niet gebruikt'}
                  </StatusBadge>
                  {instance.state !== 'unknown' && <span className="text-gray-500 dark:text-gray-400">{formatAge(instance.ageMs)}</span>}
                  <span className="text-gray-500 dark:text-gray-400">{instance.host}</span>
                </span>
              </KeyValueRow>
            ))}
          </dl>}
      </Section>

      <Section title="Statistieken">
        <dl>
          <KeyValueRow label="Pagina">{data.stats.page === 'configured' ? 'Ingesteld' : 'Niet ingesteld'}</KeyValueRow>
          <KeyValueRow label="Database">
            {data.stats.database === 'enabled'
              ? <StatusBadge tone="ok">Aan</StatusBadge>
              : data.stats.database === 'disabled' ? <StatusBadge tone="neutral">Uit</StatusBadge> : <StatusBadge tone="warn">Nog geen configuratie</StatusBadge>}
          </KeyValueRow>
          {data.stats.database === 'enabled' && <>
            <KeyValueRow label="Statistiekenmap">
              {data.stats.folder === 'set' ? 'Gekoppeld' : <StatusBadge tone="error">Niet gekoppeld (STATS_DIR)</StatusBadge>}
            </KeyValueRow>
            {data.stats.shareHost && <KeyValueRow label="Statistiek-pc">{data.stats.shareHost}</KeyValueRow>}
            {data.stats.share && <DatabaseRows share={data.stats.share} keepCopy={data.stats.keepCopy} now={Date.now()}/>}
          </>}
        </dl>
      </Section>

      <Section title="Reserve-adressen">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Werkt de verbinding met de API niet, dan blijven deze adressen van de bridge werken (bijvoorbeeld voor de Stream Deck). Vul zelf de API-sleutel in achter <code>?key=</code>.
        </p>
        <ul className="space-y-2">
          {data.fallback.paths.map((path) => {
            const post = path.startsWith('POST ');
            const address = `${origin}${post ? path.slice(5) : path}?key=${data.fallback.key}`;
            return (
              <li key={path} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <code className="min-w-0 flex-1 break-all rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">{post ? 'POST ' : ''}{address}</code>
                <CopyButton text={address}/>
              </li>
            );
          })}
        </ul>
      </Section>
    </main>
  );
}
