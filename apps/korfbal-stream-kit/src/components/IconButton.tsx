import React from 'react';

export type IconButtonProps = {
  ariaLabel: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  children: React.ReactNode;
};

// Small accessible icon-only button wrapper
export default function IconButton({ ariaLabel, title, onClick, className, children }: IconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      title={title || ariaLabel}
      onClick={onClick}
      className={
        'inline-flex items-center justify-center rounded border border-gray-300 dark:border-gray-700 p-1 hover:bg-gray-50 dark:hover:bg-gray-800 ' +
        (className || '')
      }
    >
      {children}
    </button>
  );
}
