import React from 'react';

/** A label with its value; stacks at 360 px, side by side from `sm`. Use inside a <dl>. */
export function KeyValueRow({label, children, className = ''}: {label: string; children: React.ReactNode; className?: string}) {
  return (
    <div className={`flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-4 border-t border-gray-100 dark:border-gray-700 first:border-t-0 ${className}`}>
      <dt className="text-sm text-gray-500 dark:text-gray-400 sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}
