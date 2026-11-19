import React, {useEffect, useId, useRef, useState} from 'react';

export type AppDialogProps = {
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Red confirm button, for removing or stopping something */
  danger?: boolean;
  /** With an input field (prompt): its starting value */
  input?: {defaultValue: string; inputMode?: 'text' | 'numeric'; label?: string};
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

const FOCUSABLE = 'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The confirmation (and short input) dialog of the kit, instead of window.confirm/prompt. Opened through
 * confirmDialog()/promptDialog() in lib/dialogs.tsx. Escape cancels, Enter confirms, Tab stays inside.
 */
export default function AppDialog({title, message, confirmLabel, cancelLabel, danger, input, onConfirm, onCancel}: AppDialogProps) {
  const [value, setValue] = useState(input?.defaultValue ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else {
      confirmRef.current?.focus();
    }
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('disabled'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const confirmClass = danger
    ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-400'
    : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-400';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role={input ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={messageId}
        data-testid="app-dialog"
        className="w-full max-w-md rounded-lg bg-white p-5 text-gray-900 shadow-lg dark:bg-gray-900 dark:text-gray-100"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(value);
          }}
        >
          {title && <h2 id={titleId} className="mb-2 text-lg font-semibold">{title}</h2>}
          <p id={messageId} className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{message}</p>
          {input && (
            <input
              ref={inputRef}
              aria-label={input.label ?? message}
              inputMode={input.inputMode}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              data-testid="app-dialog-cancel"
              className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="submit"
              data-testid="app-dialog-confirm"
              className={`rounded-lg px-4 py-2 font-medium text-white focus:outline-none focus-visible:ring-2 ${confirmClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
