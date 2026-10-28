import React from 'react';

/** A link or button in a NavDropdown. */
export const navMenuItemClass = 'flex px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 items-center gap-2';
/** A small heading between the items of a NavDropdown. */
export const navMenuHeadingClass = 'px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold';

/** The gear (or logo) in a nav bar: a summary that opens a small menu right below it. */
export const navIconSummaryClass = 'list-none cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';

/**
 * A menu in a nav bar (LIVE and Beheer). Controlled, so the nav can close it on a route change and keep
 * one menu open at a time.
 */
export function NavDropdown({open, onToggle, label, summary, summaryClassName = navIconSummaryClass, align = 'right', className = '', children}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  /** Accessible name and tooltip of the summary */
  label: string;
  summary: React.ReactNode;
  summaryClassName?: string;
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)} className={`relative ${className}`}>
      <summary title={label} aria-label={label} className={summaryClassName}>{summary}</summary>
      <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 min-w-56 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50`}>
        <ul className="text-sm">{children}</ul>
      </div>
    </details>
  );
}
