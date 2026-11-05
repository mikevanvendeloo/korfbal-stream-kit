import React from 'react';

export type StatusTone = 'ok' | 'warn' | 'error' | 'neutral';

const DOT: Record<StatusTone, string> = {
  ok: 'bg-green-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  neutral: 'bg-gray-400',
};

const PILL: Record<StatusTone, string> = {
  ok: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  warn: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

/** A coloured dot, optionally with its text; the colour is never the only signal, the text is always there (sr-only with `dotOnly`). */
export function StatusBadge({tone, children, dotOnly = false, className = ''}: {tone: StatusTone; children: React.ReactNode; dotOnly?: boolean; className?: string}) {
  if (dotOnly) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[tone]}`}/>
        <span className="sr-only">{children}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[tone]} ${className}`}>
      <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`}/>
      <span>{children}</span>
    </span>
  );
}
