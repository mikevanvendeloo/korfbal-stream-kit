import React from 'react';
import {createUrl} from '../lib/api';

type ClubLogoSize = 'small' | 'medium' | 'large';

type ClubLogoProps = {
  logoUrl?: string | null;
  alt: string;
  size?: ClubLogoSize;
  className?: string;
};

const sizeClasses: Record<ClubLogoSize, string> = {
  small: 'w-10 h-10',
  medium: 'w-16 h-16',
  large: 'w-36 h-36',
};

export default function ClubLogo({logoUrl, alt, size = 'medium', className = ''}: ClubLogoProps) {
  const sizeClass = sizeClasses[size];

  if (!logoUrl) {
    return (
      <div
        className={`${sizeClass} bg-gray-200 dark:bg-gray-800 rounded ${className}`}
        aria-hidden
      />
    );
  }

  // If file is from assets, use /assets/, otherwise assume it's already a full URL
  const resolvedUrl = logoUrl.startsWith('http')
    ? logoUrl
    : createUrl(`/storage/${logoUrl}`).toString();

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={`${sizeClass} object-contain ${className}`}
    />
  );
}
