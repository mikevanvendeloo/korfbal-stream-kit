import {ReactNode, useState} from 'react';

/**
 * An <img> that shows `fallback` when its file can't be loaded. The failure is remembered for that
 * `src` only: React reuses the element, so a later, good `src` (another sponsor chosen) shows again.
 * Never hide a failed image through its style (`visibility`/`display`): that sticks to the element.
 */
export default function FallbackImage({src, alt, className, fallback}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} onError={() => setFailedSrc(src)}/>;
}
