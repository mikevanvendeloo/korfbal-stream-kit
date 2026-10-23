import React from 'react';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string | null | undefined;
  /** Shown without a src, or when the image can't be loaded */
  fallback: React.ReactNode;
};

/**
 * An image that shows `fallback` when it fails to load. A new `src` gets a new chance, so a photo
 * added later (or a corrected URL) appears without a reload; it never hides itself for good.
 */
export function FallbackImage({src, fallback, alt = '', ...rest}: Props) {
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return <img {...rest} src={src} alt={alt} onError={() => setFailedSrc(src)}/>;
}
