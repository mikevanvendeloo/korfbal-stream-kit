import {useSyncExternalStore} from 'react';
import {createRoot, type Root} from 'react-dom/client';

export type ToastKind = 'success' | 'error';
type Toast = {id: number; kind: ToastKind; message: string};

/** How long a toast stays: an error longer, so there is time to read it (it also has a close button). */
const DURATION: Record<ToastKind, number> = {success: 4000, error: 8000};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
let root: Root | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The container mounts its own root on document.body the first time, so it needs no provider (also in LIVE). */
function ensureMounted() {
  if (root && document.body.contains(document.getElementById('toast-root'))) return;
  const host = document.createElement('div');
  host.id = 'toast-root';
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(<ToastContainer/>);
}

function show(kind: ToastKind, message: string) {
  ensureMounted();
  const id = nextId++;
  toasts = [...toasts, {id, kind, message}];
  emit();
  setTimeout(() => dismiss(id), DURATION[kind]);
}

/**
 * Short messages after an action, instead of window.alert: `toast.success('Opgeslagen')`, `toast.error(message)`.
 * A message that belongs to a form or a field is better shown next to it in the page.
 */
export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
};

/** For tests: removes every toast. */
export function clearToasts() {
  toasts = [];
  emit();
}

function ToastContainer() {
  const items = useSyncExternalStore(subscribe, () => toasts);
  const errors = items.filter((t) => t.kind === 'error');
  const successes = items.filter((t) => t.kind === 'success');
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 p-4 sm:items-end">
      {/* Errors are read out at once, successes when the screen reader is free */}
      <div aria-live="assertive" className="flex w-full flex-col items-center gap-2 sm:items-end">
        {errors.map((t) => <ToastItem key={t.id} toast={t}/>)}
      </div>
      <div aria-live="polite" className="flex w-full flex-col items-center gap-2 sm:items-end">
        {successes.map((t) => <ToastItem key={t.id} toast={t}/>)}
      </div>
    </div>
  );
}

function ToastItem({toast: t}: {toast: Toast}) {
  const colors = t.kind === 'error'
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
    : 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200';
  return (
    <div
      data-testid={`toast-${t.kind}`}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${colors}`}
    >
      <p className="flex-1 whitespace-pre-line">{t.message}</p>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Melding sluiten"
        className="-mr-1 rounded px-1 leading-none opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
