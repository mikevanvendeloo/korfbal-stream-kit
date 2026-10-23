import React, {ReactNode, useState} from 'react';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null;
  alt?: string;
  fallback: ReactNode;
};

/**
 * An <img> that shows `fallback` when its file can't be loaded (or there is no `src`). The failure is
 * remembered for that `src` only: React reuses the element, so a later, good `src` (another sponsor
 * chosen, another player) shows again. Never hide a failed image through its style
 * (`visibility`/`display`): that sticks to the element.
 */
export function FallbackImage({src, fallback, alt = '', ...rest}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{fallback}</>;
  return <img {...rest} src={src} alt={alt} onError={() => setFailedSrc(src)}/>;
}

export default FallbackImage;
