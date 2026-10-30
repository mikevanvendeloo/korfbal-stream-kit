import type {DeviceStatus} from '../hooks/usePolledDevice';

export type DeviceStatusEntry = {
  name: string;
  status: DeviceStatus;
  onReconnect: () => void;
};

const STATUS_TEXT: Record<DeviceStatus, string> = {
  connected: 'verbonden',
  connecting: 'verbinden…',
  disconnected: 'geen verbinding',
};

const DOT_CLASS: Record<DeviceStatus, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-gray-500',
  disconnected: 'bg-red-500',
};

/** Connection state per device, with a Reconnect button next to a disconnected one. */
export default function DeviceStatusBar({devices}: { devices: DeviceStatusEntry[] }) {
  return (
    <div
      role="status"
      aria-label="Verbinding apparaten"
      className="sticky bottom-0 w-full border-t border-white/10 bg-black/90 px-4 py-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
    >
      {devices.map((d) => (
        <div key={d.name} className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[d.status]}`} />
          <span className="truncate text-gray-200">
            {d.name}
            <span className="sr-only">: {STATUS_TEXT[d.status]}</span>
          </span>
          {d.status === 'disconnected' ? (
            <>
              <span className="text-red-400 text-xs shrink-0" aria-hidden="true">{STATUS_TEXT.disconnected}</span>
              <button
                type="button"
                onClick={d.onReconnect}
                aria-label={`Reconnect ${d.name}`}
                className="shrink-0 rounded border border-white/30 px-2 py-1 text-xs font-medium text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Reconnect
              </button>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
