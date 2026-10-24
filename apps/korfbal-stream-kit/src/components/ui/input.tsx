import React from 'react';

export const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-gray-300 bg-white text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 dark:placeholder:text-white/40 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  );
};
