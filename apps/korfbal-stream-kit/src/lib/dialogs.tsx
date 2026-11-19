import type {ReactElement} from 'react';
import {createRoot} from 'react-dom/client';
import AppDialog from '../components/AppDialog';

export type ConfirmOptions = {
  title?: string;
  /** Default: OK */
  confirmLabel?: string;
  /** Default: Annuleren */
  cancelLabel?: string;
  /** Red confirm button, for removing or stopping something */
  danger?: boolean;
};

export type PromptOptions = {
  title?: string;
  defaultValue?: string;
  /** Default: OK */
  confirmLabel?: string;
  inputMode?: 'text' | 'numeric';
};

/**
 * Shows the kit's own dialog (components/AppDialog) and resolves with the answer; use these instead of
 * window.confirm/prompt, which cannot be styled and block the page. The dialog mounts its own root on
 * document.body, so it needs no provider and also works in LIVE; focus returns to where it was.
 */
function open<T>(render: (close: (value: T) => void) => ReactElement): Promise<T> {
  return new Promise<T>((resolve) => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let done = false;
    const close = (value: T) => {
      if (done) return;
      done = true;
      // Hide at once, unmount after the click that closed it has finished
      host.hidden = true;
      queueMicrotask(() => {
        root.unmount();
        host.remove();
      });
      previous?.focus();
      resolve(value);
    };
    root.render(render(close));
  });
}

/** Asks a yes/no question; true when confirmed. */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return open<boolean>((close) => (
    <AppDialog
      title={options.title}
      message={message}
      confirmLabel={options.confirmLabel ?? 'OK'}
      cancelLabel={options.cancelLabel ?? 'Annuleren'}
      danger={options.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ));
}

/** Asks for a short text; the text (untrimmed), or null when cancelled. */
export function promptDialog(message: string, options: PromptOptions = {}): Promise<string | null> {
  return open<string | null>((close) => (
    <AppDialog
      title={options.title}
      message={message}
      confirmLabel={options.confirmLabel ?? 'OK'}
      cancelLabel="Annuleren"
      input={{defaultValue: options.defaultValue ?? '', inputMode: options.inputMode}}
      onConfirm={(value) => close(value)}
      onCancel={() => close(null)}
    />
  ));
}
