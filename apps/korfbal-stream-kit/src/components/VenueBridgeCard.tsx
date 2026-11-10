import {Card, CardContent, CardHeader, CardTitle, KeyValueRow, StatusBadge, type StatusTone} from '@korfbal-stream-kit/ui';
import {useVenueBridgeStatus} from '../hooks/useVenueBridgeStatus';
import {formatDateTime} from '../lib/time';
import type {VenueDeviceName, VenueDeviceState} from '../lib/venueBridge';

const POLL_MS = 5000;

const DEVICES: {key: VenueDeviceName; label: string}[] = [
  {key: 'score', label: 'Scorebord'},
  {key: 'clock', label: 'Zaalklok'},
  {key: 'shotclock', label: 'Shotclock'},
];

const DEVICE_STATE: Record<VenueDeviceState, {tone: StatusTone; text: string}> = {
  ok: {tone: 'ok', text: 'In orde'},
  unreachable: {tone: 'error', text: 'Niet bereikbaar'},
  invalid: {tone: 'error', text: 'Ongeldig antwoord'},
  'not-configured': {tone: 'neutral', text: 'Niet ingesteld'},
  'no-data': {tone: 'warn', text: 'Geen recente meting'},
};

const CONFIG_STATE = {
  applied: {tone: 'ok' as StatusTone, text: 'Toegepast'},
  pending: {tone: 'warn' as StatusTone, text: 'Wacht op bevestiging'},
  refused: {tone: 'error' as StatusTone, text: 'Geweigerd'},
};

function formatAge(ageMs: number | null): string {
  if (ageMs === null) return 'nog geen meting';
  const s = Math.round(ageMs / 1000);
  return s < 60 ? `${s} s geleden` : `${Math.floor(s / 60)} min geleden`;
}

/** Instellingen → Venue: is the venue-bridge connected, did it take the configuration, and how are the devices. */
export default function VenueBridgeCard() {
  const {data, isError, error} = useVenueBridgeStatus(POLL_MS);
  return (
    <Card>
      <CardHeader className="p-4"><CardTitle className="text-lg">Venue-bridge</CardTitle></CardHeader>
      <CardContent className="p-4" >
        {isError && <p role="alert" className="text-sm text-red-600">{(error as Error).message}</p>}
        {!data && !isError && <p className="text-sm text-gray-600 dark:text-gray-300">Laden…</p>}
        {data && (
          <dl aria-label="Status van de venue-bridge">
            <KeyValueRow label="Verbinding">
              <StatusBadge tone={data.connected ? 'ok' : 'error'}>{data.connected ? 'Verbonden' : 'De venue-bridge is offline'}</StatusBadge>
            </KeyValueRow>
            {data.connected && <>
              <KeyValueRow label="Naam">{data.name}</KeyValueRow>
              <KeyValueRow label="Versie">{data.version}</KeyValueRow>
              {data.connectedAt && <KeyValueRow label="Verbonden sinds">{formatDateTime(data.connectedAt)}</KeyValueRow>}
              <KeyValueRow label="Configuratie">
                <StatusBadge tone={CONFIG_STATE[data.config.state].tone}>{CONFIG_STATE[data.config.state].text}</StatusBadge>
                {data.config.state === 'refused' && data.config.error && <p role="alert" className="mt-1 text-red-600">{data.config.error}</p>}
              </KeyValueRow>
              {DEVICES.map(({key, label}) => {
                const {state, ageMs} = data.devices[key];
                const view = DEVICE_STATE[state];
                return (
                  <KeyValueRow key={key} label={label}>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge tone={view.tone}>{view.text}</StatusBadge>
                      {state !== 'not-configured' && <span className="text-gray-500 dark:text-gray-400">{formatAge(ageMs)}</span>}
                    </span>
                  </KeyValueRow>
                );
              })}
              {data.pageUrl && /^https?:\/\//i.test(data.pageUrl) && (
                <KeyValueRow label="Pagina van de bridge">
                  <a href={data.pageUrl} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline break-all">{data.pageUrl}</a>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Deze pagina werkt alleen op het netwerk van de zaal.</p>
                </KeyValueRow>
              )}
            </>}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
